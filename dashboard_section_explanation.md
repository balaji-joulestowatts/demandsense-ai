# Demand Forecasting & Simulation Dashboard: Section-by-Section Explanation

This document explains each section of the DemandSense AI Studio dashboard, why it exists, what it conveys, and provides simple, client-friendly examples (e.g., using a laptop as a product). All abbreviations are expanded for clarity.

---

## 1. Prediction Cockpit: Demand Forecasting

**Why is it here?**
- This is the main control panel for viewing and managing demand forecasts for different product categories (e.g., Electronics, Components, Raw Materials, Finished Goods).

**What does it do?**
- Lets users switch between product groups to see tailored forecasts.
- Shows the latest demand predictions using advanced machine learning models.

**Example:**
- If you sell laptops, you can select "Electronics" to see how many laptops you are expected to sell next month.

---

## 2. Monthly Forecast

**Why is it here?**
- Provides a quick snapshot of the expected sales or demand for the selected product in the upcoming month.

**What does it do?**
- Shows the forecasted number (e.g., 4,480 units) and how it compares to last month (e.g., -1.8%).
- Breaks down the probability of different scenarios: Bull (optimistic), Base (most likely), Bear (pessimistic).

**Example:**
- For laptops, you might see: "We expect to sell 4,480 units next month, which is 1.8% less than last month."

---

## 3. Scenario Blend: Signal-Derived Probability

**Why is it here?**
- Shows how likely each demand scenario is, based on external signals (like freight, economy, and order backlog).

**What does it do?**
- Uses machine learning to blend signals and estimate the probability of Bull, Base, and Bear cases.

**Example:**
- "There is an 82% chance that laptop demand will follow the Base scenario, 11% for Bull, and 7% for Bear."

---

## 4. Forecast Overview: Key Demand & Supply Signals

**Why is it here?**
- Summarizes the most important demand and supply metrics at a glance.

**What does it do?**
- Shows:
  - Orders Received: How many customer orders came in.
  - Orders Shipped: How many were delivered.
  - Cancel Rate: Percentage of orders canceled.
  - Confidence: How certain the model is about the forecast.

**Example:**
- "Last month, you received 1,116 laptop orders, shipped 1,120, had a 3.2% cancel rate, and the forecast confidence is 91%."

---

## 5. Control Tower: Inventory & Supply Briefing

**Why is it here?**
- Gives a scenario-aware summary of inventory, inbound purchase orders, and requirements.

**What does it do?**
- Shows:
  - Current Net Stock: What you have now.
  - Required (This Week/Month): What you need to meet demand.
  - Inbound Next Week/4 Weeks: What is arriving soon.
  - Net End of Month: Projected stock at month-end.
  - Stockout Risks: Number of parts at risk of running out.

**Example:**
- "You have 38,900 laptops in stock, need 8,960 this week, 35,840 this month, and expect 15,000 to arrive in the next 4 weeks. 6 parts are at risk of stockout."

---

## 6. Inventory Position: Net Now – Inbound – Required (4 Weeks)

**Why is it here?**
- Visualizes if current and incoming stock can meet the next 4 weeks of demand.

**What does it do?**
- Bar chart shows:
  - Net Now: Current stock.
  - Inbound (4w): What is arriving in 4 weeks.
  - Required (4w): What is needed in 4 weeks.
  - Net End (4w): Projected stock after 4 weeks.

**Example:**
- "You have 20,000 laptops now, 10,000 arriving, need 25,000 in 4 weeks, so you’ll end with 5,000."

---

## 7. Inbound Outlook: Purchase Order Arrivals by Week

**Why is it here?**
- Shows when and how much stock will arrive from open purchase orders.

**What does it do?**
- Bar chart by week for the next 8 weeks.
- Helps spot risks if arrivals are clustered or delayed.

**Example:**
- "Most laptop shipments arrive in week 3. If demand spikes earlier, you could run out before then."

---

## 8. Priority List: Top Parts at Risk (What Breaks First)

**Why is it here?**
- Highlights the most critical components at risk of running out.

**What does it do?**
- Lists parts with low stock, high demand, or delayed inbound.
- Shows net now, required, safety stock, and stockout week.

**Example:**
- "Laptop screens and batteries are at highest risk of stockout in week 5."

---

## 9. Agent: Actions & Deep Dives

**Why is it here?**
- Provides AI-powered explanations, risk analysis, scenario comparisons, and executive reports.

**What does it do?**
- Lets users:
  - Get explanations of stock vs. requirement.
  - See risk and mitigation strategies.
  - Compare scenarios (Bull/Base/Bear).
  - Generate executive reports.

**Example:**
- "Explain why laptop inventory is below safety stock and what actions to take."

---

## 10. Scenario Forecast: Demand Outlook (Bull, Base, Bear)

**Why is it here?**
- Shows detailed demand projections for each scenario over different time horizons (4, 8, 13, 26, 52 weeks).

**What does it do?**
- Bar/line charts for each scenario.
- Lets users stress-test plans against best, worst, and most likely cases.

**Example:**
- "If the market booms (Bull), you’ll need 1,520 laptops at peak. If it contracts (Bear), only 870."

---

## 11. Model Accuracy: Machine Learning vs. Baseline

**Why is it here?**
- Proves the value of the machine learning model by comparing its accuracy to traditional methods.

**What does it do?**
- Shows Mean Absolute Percentage Error (MAPE) for both models.
- Highlights improvement (e.g., 18.4% better).

**Example:**
- "Our model predicts laptop demand 18.4% more accurately than the old method."

---

## 12. Supply Control Tower: Weeks of Cover by Component

**Why is it here?**
- Visualizes how many weeks each part will last at current demand rates.

**What does it do?**
- Bar chart shows weeks of cover for each component.
- Red/orange bars highlight risk.

**Example:**
- "Laptop batteries will last 2 weeks, screens 4 weeks, but keyboards are safe for 12 weeks."

---

## 13. Inventory vs. Requirement: Can We Cover the Next 4 Weeks?

**Why is it here?**
- Checks if available and inbound stock can meet 4-week demand for each part.

**What does it do?**
- Bar chart: green = enough, orange = shortfall.
- Hover for breakdown (on hand, inbound, required).

**Example:**
- "You have enough laptop screens, but not enough batteries for the next month."

---

## 14. Most Constrained Component: Projected Inventory Trajectory

**Why is it here?**
- Focuses on the part most at risk of running out.

**What does it do?**
- Line/bar chart shows weekly inbound, required, and safety stock.
- Helps plan urgent actions.

**Example:**
- "Laptop batteries will go below safety stock in week 3 unless more are ordered."

---

## 15. Risk Map: Which Parts Need Urgent Attention?

**Why is it here?**
- Visualizes which parts are most critical based on lead time and stock cover.

**What does it do?**
- Bubble chart: top-right = long lead time, low cover (most urgent).
- Color codes: red = act now, yellow = watch, green = OK.

**Example:**
- "Laptop screens take 8 weeks to restock and are nearly out — order immediately."

---

## 16. Recommended Orders (Top Parts)

**Why is it here?**
- Suggests what to order, how much, and when, to avoid stockouts.

**What does it do?**
- Bar chart and table of recommended order quantities for each part.
- Shows supplier, lead time, current stock, safety stock, inbound, required, and order quantity.

**Example:**
- "Order 9,500 laptop batteries now to stay above safety stock for the next 8 weeks."

---

## 17. Parts to Restock (Recommended)

**Why is it here?**
- Detailed table of parts that need to be reordered soon.

**What does it do?**
- Lists each part, supplier, lead time, net now, safety, inbound, required, net end, order quantity, and stockout status.

**Example:**
- "Order 6,000 laptop screens from Supplier A (lead time: 7 weeks) to avoid stockout in week 5."

---

## 18. Upcoming Parts Orders (Open Purchase Orders)

**Why is it here?**
- Tracks all open purchase orders and their expected arrivals.

**What does it do?**
- Table of purchase orders, suppliers, status (confirmed, in transit, planned), estimated time of arrival, and lines (parts).
- Helps coordinate with suppliers and plan for incoming stock.

**Example:**
- "PO-18421 for 3,000 laptop screens from Supplier A is in transit, arriving week 2."

---

## 19. Incoming by Part (Next 8 Weeks)

**Why is it here?**
- Shows, for each part, how much is on order, next arrival week, and number of open purchase orders.

**What does it do?**
- Table view for quick reference.

**Example:**
- "You have 10,000 laptop batteries on order, arriving week 3, across 1 purchase order."

---

## 20. Machine Learning Ensemble MAPE (Mean Absolute Percentage Error)

**Why is it here?**
- Quantifies the accuracy of the machine learning ensemble (combining Gradient Boosting and Long Short-Term Memory networks) compared to the traditional baseline.

**What does it do?**
- Shows error rates for different forecast horizons (1 week, 1 month, 3 months).
- Highlights improvement percentage.
- Lists last and next retrain dates.

**Example:**
- "For laptops, the machine learning model’s average error is 8.0% (vs. 14.9% for the old method), an 18.4% improvement."

---

# Summary

This dashboard brings together demand forecasting, scenario simulation, inventory management, and risk analysis in one place. It helps sales, operations, and supply chain teams make smarter, faster decisions by showing what’s coming, what’s at risk, and what actions to take — all with clear, actionable insights.
