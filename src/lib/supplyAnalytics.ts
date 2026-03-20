import { type SupplyProfile } from "@/data/forecastData";

export type ReorderRow = {
  partId: string;
  partName: string;
  supplier: string;
  uom: string;
  leadTimeWeeks: number;
  qtyPerSku: number;
  onHand: number;
  allocated: number;
  netAvailable: number;
  safetyStock: number;
  onOrderHorizon: number;
  nextEtaWeek: number | null;
  requiredPerWeek: number;
  requiredHorizon: number;
  projectedEnding: number;
  recommendedOrder: number;
  moq: number;
  orderMultiple?: number;
  stockoutWeek: number | null;
  belowSafetyWeek: number | null;
  coverWeeks: number | null;
  riskLabel: string;
  riskTone: "ok" | "watch" | "act";
};

function roundUpToMultiple(qty: number, multiple?: number): number {
  if (!multiple || multiple <= 1) return Math.ceil(qty);
  return Math.ceil(qty / multiple) * multiple;
}

export function computeReorderRows({
  supply,
  productionCommitPerWeek,
  procurementWeek,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  productionCommitPerWeek: number;
  procurementWeek: number;
  horizonWeeks: number;
}): { rows: ReorderRow[]; poLinesHorizonByPart: Record<string, number> } {
  const partById = new Map(supply.parts.map((p) => [p.id, p] as const));
  const bomByPart = new Map(supply.bom.map((b) => [b.part_id, b.qty_per_sku] as const));
  const invByPart = new Map(supply.inventory.map((i) => [i.part_id, i] as const));

  const poLinesHorizonByPart: Record<string, number> = {};
  for (const po of supply.open_pos) {
    if (po.eta_week > horizonWeeks) continue;
    for (const line of po.lines) {
      poLinesHorizonByPart[line.part_id] = (poLinesHorizonByPart[line.part_id] || 0) + line.qty;
    }
  }

  const rows: ReorderRow[] = supply.parts.map((part) => {
    const qtyPerSku = bomByPart.get(part.id) ?? 0;
    const inv = invByPart.get(part.id);
    const onHand = inv?.on_hand ?? 0;
    const allocated = inv?.allocated ?? 0;
    const netAvailable = Math.max(0, onHand - allocated);
    const safetyStock = inv?.safety_stock ?? 0;
    const onOrderHorizon = poLinesHorizonByPart[part.id] ?? 0;
    const requiredPerWeek = productionCommitPerWeek * qtyPerSku;
    const requiredHorizon = requiredPerWeek * horizonWeeks;

    let nextEtaWeek: number | null = null;
    for (const po of supply.open_pos) {
      for (const line of po.lines) {
        if (line.part_id !== part.id) continue;
        if (nextEtaWeek === null || po.eta_week < nextEtaWeek) nextEtaWeek = po.eta_week;
      }
    }

    // Week-by-week projection to find the earliest risk week.
    let projected = netAvailable;
    let stockoutWeek: number | null = null;
    let belowSafetyWeek: number | null = null;
    for (let w = 1; w <= horizonWeeks; w++) {
      for (const po of supply.open_pos) {
        if (po.eta_week !== w) continue;
        for (const line of po.lines) {
          if (line.part_id === part.id) projected += line.qty;
        }
      }
      projected -= requiredPerWeek;

      if (stockoutWeek === null && projected < 0) stockoutWeek = w;
      if (belowSafetyWeek === null && projected < safetyStock) belowSafetyWeek = w;
    }

    // Recommended order: cover safety stock at end of horizon.
    const projectedEnding = netAvailable + onOrderHorizon - requiredHorizon;
    const netVsSafety = projectedEnding - safetyStock;
    const rawOrder = Math.max(0, -netVsSafety);
    const orderAfterMoq = Math.max(rawOrder, rawOrder > 0 ? part.moq : 0);
    const recommendedOrder = roundUpToMultiple(orderAfterMoq, part.order_multiple);

    const coverWeeks = requiredPerWeek > 0 ? netAvailable / requiredPerWeek : null;

    const riskLabel =
      stockoutWeek !== null
        ? `Stockout risk (W${stockoutWeek})`
        : belowSafetyWeek !== null
          ? `Below safety (W${belowSafetyWeek})`
          : recommendedOrder > 0
            ? `Reorder (release W${procurementWeek})`
            : "OK";

    const riskTone: ReorderRow["riskTone"] =
      stockoutWeek !== null || recommendedOrder > 0
        ? "act"
        : belowSafetyWeek !== null
          ? "watch"
          : "ok";

    return {
      partId: part.id,
      partName: part.name,
      supplier: part.supplier,
      uom: part.uom,
      leadTimeWeeks: part.lead_time_weeks,
      qtyPerSku,
      onHand,
      allocated,
      netAvailable,
      safetyStock,
      onOrderHorizon,
      nextEtaWeek,
      requiredPerWeek,
      requiredHorizon: Math.round(requiredHorizon),
      projectedEnding: Math.round(projectedEnding),
      recommendedOrder: Math.round(recommendedOrder),
      moq: part.moq,
      orderMultiple: part.order_multiple,
      stockoutWeek,
      belowSafetyWeek,
      coverWeeks: coverWeeks !== null ? Math.round(coverWeeks * 10) / 10 : null,
      riskLabel,
      riskTone,
    };
  });

  // Sort: act-now items first, then watch, then ok.
  rows.sort((a, b) => {
    const toneRank = (t: ReorderRow["riskTone"]) => (t === "act" ? 0 : t === "watch" ? 1 : 2);
    const byTone = toneRank(a.riskTone) - toneRank(b.riskTone);
    if (byTone !== 0) return byTone;
    return b.recommendedOrder - a.recommendedOrder;
  });

  return { rows, poLinesHorizonByPart };
}

export function computeRiskTimeline({
  supply,
  productionCommitPerWeek,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  productionCommitPerWeek: number;
  horizonWeeks: number;
}): Array<{ week: string; belowSafety: number; stockout: number }> {
  const bomByPart = new Map(supply.bom.map((b) => [b.part_id, b.qty_per_sku] as const));
  const invByPart = new Map(supply.inventory.map((i) => [i.part_id, i] as const));

  const inboundByPartWeek = new Map<string, Map<number, number>>();
  for (const po of supply.open_pos) {
    if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
    for (const line of po.lines) {
      const byWeek = inboundByPartWeek.get(line.part_id) ?? new Map<number, number>();
      byWeek.set(po.eta_week, (byWeek.get(po.eta_week) ?? 0) + line.qty);
      inboundByPartWeek.set(line.part_id, byWeek);
    }
  }

  const timeline = Array.from({ length: horizonWeeks }, (_, i) => ({ week: `W${i + 1}`, belowSafety: 0, stockout: 0 }));

  for (const part of supply.parts) {
    const qtyPerSku = bomByPart.get(part.id) ?? 0;
    const inv = invByPart.get(part.id);
    const onHand = inv?.on_hand ?? 0;
    const allocated = inv?.allocated ?? 0;
    const netAvailable = Math.max(0, onHand - allocated);
    const safetyStock = inv?.safety_stock ?? 0;
    const requiredPerWeek = productionCommitPerWeek * qtyPerSku;
    const inbound = inboundByPartWeek.get(part.id);

    let projected = netAvailable;
    for (let w = 1; w <= horizonWeeks; w++) {
      projected += inbound?.get(w) ?? 0;
      projected -= requiredPerWeek;

      if (projected < 0) timeline[w - 1].stockout += 1;
      else if (projected < safetyStock) timeline[w - 1].belowSafety += 1;
    }
  }

  return timeline;
}

export function computeIncomingByPart({
  supply,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  horizonWeeks: number;
}): Array<{ partId: string; partName: string; supplier: string; onOrder: number; nextEtaWeek: number | null; poCount: number }> {
  const partById = new Map(supply.parts.map((p) => [p.id, p] as const));

  const rollup: Record<string, { onOrder: number; nextEtaWeek: number | null; poSet: Set<string> }> = {};
  for (const po of supply.open_pos) {
    if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
    for (const line of po.lines) {
      const bucket = (rollup[line.part_id] ??= { onOrder: 0, nextEtaWeek: null, poSet: new Set<string>() });
      bucket.onOrder += line.qty;
      bucket.poSet.add(po.po_number);
      if (bucket.nextEtaWeek === null || po.eta_week < bucket.nextEtaWeek) bucket.nextEtaWeek = po.eta_week;
    }
  }

  return Object.entries(rollup)
    .map(([partId, v]) => {
      const part = partById.get(partId);
      return {
        partId,
        partName: part?.name ?? partId,
        supplier: part?.supplier ?? "—",
        onOrder: Math.round(v.onOrder),
        nextEtaWeek: v.nextEtaWeek,
        poCount: v.poSet.size,
      };
    })
    .sort((a, b) => {
      const aEta = a.nextEtaWeek ?? 999;
      const bEta = b.nextEtaWeek ?? 999;
      if (aEta !== bEta) return aEta - bEta;
      return b.onOrder - a.onOrder;
    });
}

export function computePoArrivalsTimeline({
  supply,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  horizonWeeks: number;
}): Array<{ week: string; poCount: number; lineCount: number }> {
  const byWeek = new Map<number, { poSet: Set<string>; lines: number }>();
  for (const po of supply.open_pos) {
    if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
    const bucket = byWeek.get(po.eta_week) ?? { poSet: new Set<string>(), lines: 0 };
    bucket.poSet.add(po.po_number);
    bucket.lines += po.lines.length;
    byWeek.set(po.eta_week, bucket);
  }

  return Array.from({ length: horizonWeeks }, (_, i) => {
    const w = i + 1;
    const bucket = byWeek.get(w);
    return { week: `W${w}`, poCount: bucket?.poSet.size ?? 0, lineCount: bucket?.lines ?? 0 };
  });
}

export function buildPartProjection({
  supply,
  partId,
  productionCommitPerWeek,
  horizonWeeks,
}: {
  supply: SupplyProfile;
  partId: string;
  productionCommitPerWeek: number;
  horizonWeeks: number;
}): Array<{ week: string; projected: number; safety: number; inbound: number; required: number }> {
  const bomByPart = new Map(supply.bom.map((b) => [b.part_id, b.qty_per_sku] as const));
  const invByPart = new Map(supply.inventory.map((i) => [i.part_id, i] as const));

  const qtyPerSku = bomByPart.get(partId) ?? 0;
  const inv = invByPart.get(partId);
  const onHand = inv?.on_hand ?? 0;
  const allocated = inv?.allocated ?? 0;
  const netAvailable = Math.max(0, onHand - allocated);
  const safety = inv?.safety_stock ?? 0;

  const inboundByWeek = new Map<number, number>();
  for (const po of supply.open_pos) {
    if (po.eta_week < 1 || po.eta_week > horizonWeeks) continue;
    for (const line of po.lines) {
      if (line.part_id !== partId) continue;
      inboundByWeek.set(po.eta_week, (inboundByWeek.get(po.eta_week) ?? 0) + line.qty);
    }
  }

  const required = productionCommitPerWeek * qtyPerSku;
  const out: Array<{ week: string; projected: number; safety: number; inbound: number; required: number }> = [];

  let projected = netAvailable;
  for (let w = 1; w <= horizonWeeks; w++) {
    const inbound = inboundByWeek.get(w) ?? 0;
    projected += inbound;
    projected -= required;
    out.push({ week: `W${w}`, projected: Math.round(projected), safety: Math.round(safety), inbound: Math.round(inbound), required: Math.round(required) });
  }

  return out;
}
