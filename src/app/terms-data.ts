/**
 * The five commercial models, shown on /terms. `risk` is who carries the risk of the work costing
 * more than expected: 0 = the client, 1 = the studio. Wording is a draft of commercial terms:
 * no prices, no percentages.
 */
export const COMMERCIAL_MODELS = {
  label: "How we charge",
  heading: "Five ways to work with us.",
  body: "After the first conversation we agree the model that fits the work, and put it in writing before anything starts or changes.",
  models: [
    {
      n: "01",
      name: "Hourly consultation",
      line: "Advice by the hour.",
      text: "A senior second opinion: an architecture review, a technical due-diligence call, a rescue plan. You pay for the time used and can stop at any point.",
      best: "Specific questions, reviews and short pieces of advice.",
      risk: 0.08,
    },
    {
      n: "02",
      name: "Fixed price",
      line: "A defined scope for a set fee.",
      text: "We agree exactly what will be delivered and what it costs. If it takes us longer than we planned, that is our problem, not yours.",
      best: "Work that can be specified clearly up front.",
      risk: 0.92,
    },
    {
      n: "03",
      name: "Maximum price",
      line: "Pay for time used, up to a ceiling.",
      text: "You are billed for the time the work actually takes, with a cap agreed in advance. If it comes in under, you pay less. It cannot go over without your written agreement.",
      best: "Work with real unknowns, where a fixed price would mean padding.",
      risk: 0.62,
    },
    {
      n: "04",
      name: "Retainer",
      line: "Reserved capacity each month.",
      text: "A set amount of the team's time every month for a product that keeps moving: new features, improvements and support. The priorities are yours to change.",
      best: "Live products that need continuous work.",
      risk: 0.28,
    },
    {
      n: "05",
      name: "Equity",
      line: "Part fee, part stake.",
      text: "For a small number of early ventures we take part of our fee as equity, so we carry some of the risk and share in the result. We do this selectively.",
      best: "Early-stage products we believe in.",
      risk: 0.76,
    },
  ],
} as const;
