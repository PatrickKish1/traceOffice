/** Planning numbers for the hosted room. These are assumptions, not measured revenue. */
export const BUSINESS_PLAN = {
  price: "$49 / team / month",
  offer: "A hosted TraceOffice for a team. Neatlogs remains the trace bill underneath.",
  runwayNote: "One founder, $4,000 a month before revenue. Hire only after the growth case is real.",
  rows: [
    { label: "Customers", base: "40 teams", growth: "120 teams" },
    { label: "Revenue", base: "$1,960", growth: "$5,880" },
    { label: "Neatlogs + hosting", base: "$350", growth: "$900" },
    { label: "Support", base: "$400", growth: "$800" },
    { label: "Gross profit", base: "$1,210", growth: "$4,180" },
    { label: "Gross margin", base: "62%", growth: "71%" },
  ],
};
