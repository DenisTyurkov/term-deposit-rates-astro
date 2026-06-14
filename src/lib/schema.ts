/**
 * JSON-LD structured-data builders — port of JsonLdHelper + the SchemaMarkup
 * concern. Each returns a plain object that a page renders inside a
 * <script type="application/ld+json"> (see components/JsonLd.astro).
 */

import { parameterize, type Rate } from "./rates";

const ROOT = "https://www.termdepositrates.co.nz";

export type Json = Record<string, unknown>;

function termToIso8601Duration(term: string): string | null {
  let m: RegExpMatchArray | null;
  if ((m = term.match(/(\d+)\s*(month|months)/))) return `P${m[1]}M`;
  if ((m = term.match(/(\d+)\s*mths/))) return `P${m[1]}M`;
  if ((m = term.match(/(\d+)\s*(year|years)/))) return `P${m[1]}Y`;
  return null;
}

export function organizationSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${ROOT}#org`,
    name: "TermDepositRates.co.nz",
    url: ROOT,
    logo: { "@type": "ImageObject", url: `${ROOT}/favicon.ico` },
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      areaServed: "NZ",
      availableLanguage: "English",
    },
    areaServed: { "@type": "Country", name: "New Zealand", alternateName: "NZ" },
    description:
      "Compare term deposit rates from major New Zealand banks. Updated daily with the latest interest rates and terms.",
  };
}

export function websiteSchema(): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${ROOT}#website`,
    name: "TermDepositRates.co.nz",
    url: ROOT,
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${ROOT}?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
    publisher: { "@id": `${ROOT}#org` },
  };
}

export interface Breadcrumb {
  name: string;
  url: string;
}

export function breadcrumbSchema(breadcrumbs: Breadcrumb[]): Json | null {
  if (!breadcrumbs.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: breadcrumbs.map((b, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: b.name,
      item: b.url,
    })),
  };
}

export interface FaqItem {
  question: string;
  answer: string;
}

export function faqSchema(items: FaqItem[]): Json | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: { "@type": "Answer", text: faq.answer },
    })),
  };
}

export function investmentProductSchema(rate: Rate, position?: number): Json | null {
  if (!rate) return null;

  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "InvestmentOrDeposit",
    name: `${rate.bank_name} ${rate.term_length} Term Deposit`,
    provider: { "@id": `${ROOT}/${parameterize(rate.parent_bank_name)}/#org` },
    interestRate: { "@type": "QuantitativeValue", value: rate.interest_rate, unitCode: "P1A" },
    termDuration: termToIso8601Duration(rate.term_length),
    areaServed: "NZ",
    availability: "InStock",
    priceCurrency: "NZD",
  };

  if (rate.minimum_deposit != null && rate.minimum_deposit > 0) {
    schema.offers = {
      "@type": "Offer",
      priceCurrency: "NZD",
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: rate.minimum_deposit / 100.0,
        priceCurrency: "NZD",
      },
      availability: "InStock",
    };
  }

  if (position) schema.position = position;
  if (rate.scraped_at) schema.dateModified = new Date(rate.scraped_at).toISOString();

  if (position) {
    const { ["@context"]: _omit, ...rest } = schema;
    return rest;
  }
  return schema;
}

export function itemListSchema(items: Rate[], listName: string, pageUrl: string): Json | null {
  if (!items.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: listName,
    description: `Current ${listName.toLowerCase()} from New Zealand banks`,
    numberOfItems: items.length,
    itemListElement: items
      .map((item, i) => investmentProductSchema(item, i + 1))
      .filter((x): x is Json => x !== null),
    url: pageUrl,
  };
}

export function bankOrganizationSchema(bankName: string, providerSlug?: string): Json {
  const slug = providerSlug ?? parameterize(bankName);
  return {
    "@context": "https://schema.org",
    "@type": "BankOrCreditUnion",
    "@id": `${ROOT}/${slug}/#org`,
    name: bankName,
    url: `${ROOT}/${slug}/`,
    areaServed: { "@type": "Country", name: "New Zealand", alternateName: "NZ" },
    serviceArea: { "@type": "Country", name: "New Zealand" },
  };
}

export function collectionPageSchema(
  name: string,
  description: string,
  url: string,
  lastUpdated?: string | null
): Json {
  const schema: Json = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name,
    description,
    url,
    inLanguage: "en-NZ",
    isPartOf: { "@id": `${ROOT}#website` },
  };
  if (lastUpdated) schema.dateModified = new Date(lastUpdated).toISOString();
  return schema;
}

export function webApplicationSchema(name: string, description: string, url: string): Json {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name,
    description,
    url,
    applicationCategory: "FinanceApplication",
    operatingSystem: "web browser",
    offers: { "@type": "Offer", price: "0", priceCurrency: "NZD" },
    areaServed: { "@type": "Country", name: "New Zealand" },
  };
}

export const ROOT_URL = ROOT;

// Homepage FAQ items (verbatim port of homepage_faq_items).
export const homepageFaqItems: FaqItem[] = [
  {
    question: "How much money do I need to open a term deposit?",
    answer:
      "Minimum deposit requirements vary significantly between banks. Some institutions accept smaller amounts while others require larger minimum deposits. Contact individual banks to confirm their current requirements.",
  },
  {
    question: "Can I add money to an existing term deposit?",
    answer:
      "Generally, you cannot add funds to an existing term deposit once it's been established. If you want to invest additional money, you'll need to open a separate term deposit.",
  },
  {
    question: "What happens when my term deposit matures?",
    answer:
      "When your term deposit reaches maturity, you'll need to provide instructions to your bank. Common options include withdrawing the funds to your nominated account, rolling over into a new term deposit at current rates, rolling over the principal only and withdrawing the interest, or splitting the funds between multiple options.",
  },
  {
    question: "Are term deposits covered by government guarantee?",
    answer:
      "New Zealand doesn't currently have a government deposit guarantee scheme. However, the Reserve Bank of New Zealand regulates banks and monitors their financial stability. Check the credit ratings and financial strength of any institution before investing.",
  },
  {
    question: "Can I have a joint term deposit?",
    answer:
      "Many banks offer joint term deposits, though availability varies. Joint accounts typically require both account holders to agree to any changes or early withdrawals. Confirm options with your chosen bank.",
  },
  {
    question: "How is term deposit interest taxed?",
    answer:
      "Term deposit interest is taxable income in New Zealand. Banks deduct Resident Withholding Tax (RWT) at your nominated rate. It's important to provide the correct tax rate to avoid tax complications. Consult current IRD guidelines or a tax professional for advice specific to your situation.",
  },
  {
    question: "What's the longest term deposit available?",
    answer:
      "Maximum term lengths vary between banks. Some offer extended terms while others focus on shorter periods. Consider your long-term needs and the interest rate environment when selecting terms.",
  },
  {
    question: "Can I use my term deposit as security for a loan?",
    answer:
      "Some banks accept term deposits as security for loans or overdrafts. This arrangement varies by institution and may depend on the specific loan product. Discuss options with your bank if this interests you.",
  },
  {
    question: "Do I need to be a New Zealand resident to open a term deposit?",
    answer:
      "Residency requirements vary by bank. Some institutions require New Zealand residency or specific visa types, while others may accept non-resident applications with additional documentation. International tax implications may also apply.",
  },
  {
    question: "How quickly can I access my money in an emergency?",
    answer:
      "Early withdrawal processes and timeframes vary between banks. While term deposits are designed to be held until maturity, most banks have procedures for genuine financial hardship. You'll typically face interest penalties for early withdrawal. Contact your bank to understand their specific policies.",
  },
  {
    question: "Are online term deposit rates better than branch rates?",
    answer:
      "Banks may offer the same rates through different channels, though this can vary. Online-only banks may have different rate structures than traditional banks. Compare options from various sources to find suitable rates.",
  },
  {
    question: "Should I choose monthly interest payments or interest at maturity?",
    answer:
      "The choice between payment frequencies depends on your individual needs. Regular payments provide income during the term, while payment at maturity means all interest is paid at once. Consider your cash flow requirements and any potential tax implications when deciding.",
  },
];
