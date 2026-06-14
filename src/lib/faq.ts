/**
 * FAQ content for pages that emit FAQPage / answer-engine structured data.
 *
 * Single source of truth: each builder returns FaqItem[] that a page renders
 * VISIBLY (via <Faq>) *and* feeds to faqSchema(). Keeping both from one list
 * guarantees the JSON-LD matches the on-page text (a Google requirement for
 * FAQ rich results). Answers deliberately hedge specifics with "contact the
 * bank" — this is YMYL financial content and rates/terms vary by institution.
 */

import type { FaqItem } from "./schema";

/** Per-bank FAQ used on every provider page (/[slug]). */
export function providerFaqItems(bankName: string): FaqItem[] {
  return [
    {
      question: `What are the current ${bankName} term deposit rates?`,
      answer: `The ${bankName} term deposit interest rates shown above are refreshed daily from published market data so you can compare them at a glance. Rates change frequently, so confirm the current rate and any conditions directly with ${bankName} before investing.`,
    },
    {
      question: `Does ${bankName} offer special term deposit rates for seniors?`,
      answer: `Some New Zealand banks promote term deposit rates aimed at seniors or retirees, while others apply the same rates to all customers. The rates listed here are the standard published rates — contact ${bankName} to ask about any seniors, retiree or over-65 offers and eligibility.`,
    },
    {
      question: `Is a ${bankName} term deposit the same as a fixed deposit?`,
      answer: `Yes. A term deposit is also called a fixed deposit or fixed-term deposit — money is locked in for a set period at a fixed interest rate. ${bankName} uses the term "term deposit", but the product works the same way as a fixed deposit.`,
    },
    {
      question: `What is the minimum deposit for a ${bankName} term deposit?`,
      answer: `Minimum deposit requirements vary by product and term. Where a minimum is published it appears in the rates table above. Confirm the current minimum (and any maximum) directly with ${bankName}.`,
    },
    {
      question: `How is interest paid on a ${bankName} term deposit?`,
      answer: `Most New Zealand banks let you choose when interest is paid — monthly, quarterly, annually, or at maturity — and some offer compounding. The frequency you choose can affect your overall return. Check the options ${bankName} offers for your chosen term.`,
    },
    {
      question: `What happens if I break a ${bankName} term deposit early?`,
      answer: `Term deposits are designed to be held to maturity. Withdrawing early usually means a reduced interest rate, loss of accrued interest, and sometimes a notice period or fee. Ask ${bankName} for its current early-withdrawal conditions before you commit.`,
    },
    {
      question: `How is ${bankName} term deposit interest taxed in New Zealand?`,
      answer: `Interest is taxable income. ${bankName} deducts Resident Withholding Tax (RWT) at the rate tied to your IRD number; PIE term deposits are instead taxed at your Prescribed Investor Rate (capped at 28%). Give the bank your correct tax details and consult IRD or a tax adviser for your situation.`,
    },
  ];
}

/** /term-deposit-rates-for-seniors */
export function seniorsFaqItems(): FaqItem[] {
  return [
    {
      question: "Do New Zealand banks offer better term deposit rates for seniors?",
      answer:
        "Some banks run promotions or accounts aimed at seniors and retirees, but most publish a single term deposit rate available to all customers regardless of age. The best approach is to compare every bank's standard rate (as shown here) and then ask each provider whether a seniors or retiree rate applies to you.",
    },
    {
      question: "Are term deposits a good option for retirees?",
      answer:
        "Term deposits (also called fixed deposits) suit many retirees because the return is fixed and the principal is not exposed to market movements. Choosing interest paid monthly can provide regular income. Weigh this certainty against inflation and your need to access funds before maturity.",
    },
    {
      question: "Can I receive term deposit interest monthly for income?",
      answer:
        "Yes. Most banks let you choose monthly interest payments instead of interest at maturity, which is popular with retirees using a deposit for regular income. Monthly payment options and any rate differences should be confirmed with the bank.",
    },
    {
      question: "How is term deposit interest taxed for superannuitants?",
      answer:
        "Interest is taxable income and may affect your overall tax position. Resident Withholding Tax is deducted at the rate linked to your IRD number, and PIE term deposits are taxed at your Prescribed Investor Rate (max 28%). Consult IRD or a tax adviser about your circumstances.",
    },
  ];
}

/** /short-term-deposit-rates */
export function shortTermFaqItems(): FaqItem[] {
  return [
    {
      question: "What counts as a short-term deposit in New Zealand?",
      answer:
        "Short-term deposits generally run from one month up to about 12 months. They suit money you'll need relatively soon — an emergency buffer, a near-term purchase, or funds you want to keep flexible while still earning a fixed return.",
    },
    {
      question: "Which bank has the best short-term deposit rate?",
      answer:
        "The most competitive short-term rate changes regularly between banks. The table above ranks current rates for 1–12 month terms across major NZ banks so you can see the leader at a glance, then confirm it directly with the bank.",
    },
    {
      question: "Are short-term or long-term deposit rates higher?",
      answer:
        "It depends on the interest-rate environment. Sometimes shorter terms pay more than longer ones (an inverted curve), sometimes less. Compare both our short-term and long-term tables before deciding how long to lock in.",
    },
    {
      question: "Can I get my money out of a short-term deposit early?",
      answer:
        "Early withdrawal is usually possible but typically reduces your interest and may require notice or a fee. If you might need the money at short notice, a shorter term or a notice-saver account can be a better fit.",
    },
  ];
}

/** /long-term-deposit-rates */
export function longTermFaqItems(): FaqItem[] {
  return [
    {
      question: "What is a long-term deposit?",
      answer:
        "A long-term deposit (or long-term fixed deposit) locks your money in for roughly one year or more — commonly 1, 2, 3, 4 or 5 years — at a fixed interest rate. It suits savings you won't need for a while and want to shield from rate cuts.",
    },
    {
      question: "Should I lock in a long-term deposit when rates are high?",
      answer:
        "Locking in a longer term secures today's rate for the whole period, which protects you if rates fall — but means you miss out if rates rise. Many savers ladder several deposits with different maturities to balance this trade-off.",
    },
    {
      question: "Do long-term deposits pay higher interest?",
      answer:
        "Not always. Longer terms sometimes pay more than shorter ones and sometimes less, depending on the rate cycle. Compare the current long-term and short-term tables before committing for several years.",
    },
    {
      question: "Can I access a long-term deposit before maturity?",
      answer:
        "Generally only by breaking it early, which usually reduces your interest and may involve notice or a fee. Keep separate accessible savings for emergencies so you don't have to break a multi-year deposit.",
    },
  ];
}

/** /6-month-term-deposit-rates and /12-month-term-deposit-rates */
export function termLengthFaqItems(label: string): FaqItem[] {
  return [
    {
      question: `Which bank has the best ${label} term deposit rate?`,
      answer: `The leading ${label} rate moves between banks over time. The table above shows current ${label} term deposit (fixed deposit) rates across major New Zealand banks, ranked so you can spot the best available rate, then confirm it with the bank.`,
    },
    {
      question: `Is a ${label} term deposit right for me?`,
      answer: `A ${label} term is a popular middle ground — long enough to earn a competitive fixed rate, short enough that your money isn't locked away for years. It suits a specific savings goal or money you won't need until around then.`,
    },
    {
      question: `What happens at the end of a ${label} term deposit?`,
      answer: `At maturity you can withdraw the funds, reinvest at the current rate, or roll over the principal and take the interest. Banks differ on automatic rollover and grace periods, so set your instructions before maturity.`,
    },
  ];
}

/** /term-deposit-calculator */
export function calculatorFaqItems(): FaqItem[] {
  return [
    {
      question: "How does the term deposit calculator work?",
      answer:
        "Enter your deposit amount, term length and a bank, and the calculator applies live NZ rates to estimate your interest and total return. You can compare interest paid at maturity against regular payments to see the effect of compounding.",
    },
    {
      question: "Are the calculator results before or after tax?",
      answer:
        "Results show gross interest before tax. Interest is taxable income — Resident Withholding Tax is deducted at the rate tied to your IRD number, and PIE term deposits use your Prescribed Investor Rate (max 28%). Factor tax in when comparing real returns.",
    },
    {
      question: "Does the calculator use current bank rates?",
      answer:
        "Yes. It uses the same daily-updated rates shown across the site, drawn from major New Zealand banks. Always confirm the exact rate with the bank before investing, as rates can change between updates.",
    },
    {
      question: "How is term deposit interest calculated?",
      answer:
        "Interest at maturity is calculated on your principal for the full term at the fixed rate. With regular payments, interest can compound if reinvested. The calculator illustrates both so you can see how payment frequency changes your total return.",
    },
  ];
}

/** /pie-term-deposit-rates — mirrors the questions shown on the PIE page. */
export function pieFaqItems(): FaqItem[] {
  return [
    {
      question: "What is my PIR and how do I find it?",
      answer:
        "Your PIR is based on your taxable income in the two preceding tax years. PIRs are 10.5%, 17.5%, or 28%. You can find your correct PIR using the IRD's PIR calculator or consult a tax professional.",
    },
    {
      question: "Can I switch from a traditional term deposit to a PIE term deposit?",
      answer:
        "You cannot directly convert existing term deposits to PIE structures. You would need to wait for maturity or break your current deposit and reinvest in a PIE term deposit.",
    },
    {
      question: "Are PIE term deposits as secure as regular term deposits?",
      answer:
        "PIE term deposits typically offer the same principal protection as traditional term deposits when invested with the same institution. However, verify the specific structure and guarantees with your chosen provider.",
    },
    {
      question: "Do I need to declare PIE investments in my tax return?",
      answer:
        "Generally, PIE investments don't require declaration in your annual tax return as tax is calculated and paid at the PIE level. However, you should keep records of your investments and consult current IRD guidelines.",
    },
    {
      question: "What happens if my income changes and my PIR should be different?",
      answer:
        "You should notify your PIE provider if your circumstances change and your PIR needs updating. Using an incorrect PIR can result in tax implications at year-end.",
    },
    {
      question: "Can non-residents invest in PIE term deposits?",
      answer:
        "PIE investments are generally available to New Zealand tax residents. Non-residents may face different tax treatment and should seek specific advice about their eligibility and tax implications.",
    },
  ];
}
