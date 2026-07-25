/**
 * Best-rate-finder quiz island. Same conventions as calculator.ts: vanilla TS,
 * [data-quiz] root with an init guard, build-time JSON blob for the data, and
 * astro:page-load re-init.
 *
 * Submits the lead to the nz-leads cross-site intake endpoint
 * (PUBLIC_LEAD_INTAKE_URL, inlined at build time), then reveals the visitor's
 * matched rates from the #quiz-rates-data blob. The endpoint validates with the
 * same rules as src/lib/leadValidation.ts, so anything we accept, it accepts.
 */

import { isValidEmail, isValidPhone, normalizePhone } from "../lib/leadValidation";

interface FinderRate {
  bank: string;
  term: string;
  termLabel: string;
  rate: number;
  minDeposit: number | null;
}

interface QuizData {
  updatedLabel: string | null;
  buckets: Record<string, FinderRate[]>;
}

const TOTAL_STEPS = 5;

// The endpoint is public (it ends up in the shipped bundle either way), so the
// production URL is committed here rather than living in deploy config.
// PUBLIC_LEAD_INTAKE_URL overrides it at build time — e.g. a local nz-leads
// dev server — never unsets it.
const INTAKE_URL = import.meta.env.PUBLIC_LEAD_INTAKE_URL || "https://www.broadband.co.nz/api/leads/intake";

function dataLayerPush(event: Record<string, unknown>): void {
  const w = window as any;
  w.dataLayer = w.dataLayer || [];
  w.dataLayer.push(event);
}

function initQuiz(): void {
  const root = document.querySelector<HTMLElement>("[data-quiz]");
  if (!root || (root as any)._quizInit) return;
  (root as any)._quizInit = true;

  const dataEl = root.querySelector<HTMLScriptElement>("#quiz-rates-data");
  const quizData: QuizData = dataEl ? JSON.parse(dataEl.textContent || "{}") : { updatedLabel: null, buckets: {} };

  const form = root.querySelector<HTMLFormElement>("[data-quiz-form]")!;
  const steps = [...root.querySelectorAll<HTMLFieldSetElement>("[data-quiz-step]")];
  const stepLabel = root.querySelector<HTMLElement>("[data-quiz-step-label]")!;
  const bar = root.querySelector<HTMLElement>("[data-quiz-bar]")!;
  const backBtn = root.querySelector<HTMLButtonElement>("[data-quiz-back]")!;
  const progress = root.querySelector<HTMLElement>("[data-quiz-progress]")!;
  const errorEl = root.querySelector<HTMLElement>("[data-quiz-error]")!;
  const submitBtn = root.querySelector<HTMLButtonElement>("[data-quiz-submit]")!;
  const results = root.querySelector<HTMLElement>("[data-quiz-results]")!;
  const resultsSub = root.querySelector<HTMLElement>("[data-quiz-results-sub]")!;
  const resultsList = root.querySelector<HTMLElement>("[data-quiz-results-list]")!;

  let currentStep = 1;
  let amountBound = 0; // lower bound of the chosen deposit bucket, dollars
  let termBucket = "";

  function showStep(step: number): void {
    currentStep = step;
    for (const fieldset of steps) {
      fieldset.hidden = Number(fieldset.dataset.quizStep) !== step;
    }
    stepLabel.textContent = `Step ${step} of ${TOTAL_STEPS}`;
    bar.style.width = `${(step / TOTAL_STEPS) * 100}%`;
    backBtn.classList.toggle("hidden", step === 1);
    dataLayerPush({ event: "quiz_step_view", quiz_step: step });
  }

  root.querySelectorAll<HTMLButtonElement>("[data-quiz-option]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const field = form.elements.namedItem(btn.dataset.answer!) as HTMLInputElement;
      field.value = btn.dataset.value!;
      if (btn.dataset.bound) amountBound = Number(btn.dataset.bound);
      if (btn.dataset.bucket) termBucket = btn.dataset.bucket;
      if (currentStep < TOTAL_STEPS) showStep(currentStep + 1);
    });
  });

  backBtn.addEventListener("click", () => {
    if (currentStep > 1) showStep(currentStep - 1);
  });

  function showError(message: string): void {
    errorEl.textContent = message;
    errorEl.classList.remove("hidden");
  }

  function matchedRates(): FinderRate[] {
    const bucket = quizData.buckets[termBucket] || [];
    const affordable = bucket.filter((r) => r.minDeposit == null || r.minDeposit <= amountBound);
    return (affordable.length ? affordable : bucket).slice(0, 3);
  }

  function renderResults(): void {
    form.hidden = true;
    progress.hidden = true;
    results.hidden = false;

    const termAnswer = (form.elements.namedItem("quiz_term_length") as HTMLInputElement).value;
    resultsSub.textContent = quizData.updatedLabel
      ? `Today's top ${termAnswer} rates for your deposit — updated ${quizData.updatedLabel}.`
      : `Today's top ${termAnswer} rates for your deposit.`;

    const rates = matchedRates();
    if (!rates.length) {
      resultsList.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <p>No matching rates right now — see the full comparison below.</p>
        </div>`;
      return;
    }
    resultsList.innerHTML = rates
      .map((r, index) => {
        const cardClass = index === 0 ? "border-green-200 bg-green-50" : "border-gray-200 bg-white";
        const rateClass = index === 0 ? "text-green-600" : "text-gray-900";
        const label = index === 0 ? "Best match" : `#${index + 1}`;
        const minDep = r.minDeposit != null ? `Min deposit $${r.minDeposit.toLocaleString("en-NZ")}` : "No stated minimum";
        return `
        <div class="border ${cardClass} rounded-lg p-4">
          <div class="flex justify-between items-center">
            <div>
              <div class="font-medium text-gray-900">${r.bank}</div>
              <div class="text-sm text-gray-600">${label} · ${r.termLabel} term · ${minDep}</div>
            </div>
            <div class="font-bold text-2xl ${rateClass}">${r.rate.toFixed(2)}%</div>
          </div>
        </div>`;
      })
      .join("");
  }

  function collectTracking(): { key: string; value: string }[] {
    const tracking: { key: string; value: string }[] = [];
    for (const key of ["quiz_deposit_amount", "quiz_term_length", "quiz_current_bank", "quiz_goal_timing"]) {
      const field = form.elements.namedItem(key) as HTMLInputElement;
      if (field.value) tracking.push({ key, value: field.value });
    }
    const params = new URLSearchParams(window.location.search);
    for (const key of ["gclid", "msclkid", "utm_source"]) {
      const value = params.get(key);
      if (value) tracking.push({ key, value });
    }
    if (document.referrer) tracking.push({ key: "referer", value: document.referrer });
    return tracking;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    errorEl.classList.add("hidden");

    const name = (form.elements.namedItem("name") as HTMLInputElement).value.trim();
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const phone = normalizePhone((form.elements.namedItem("phone") as HTMLInputElement).value);
    const hp = (form.elements.namedItem("bot-field") as HTMLInputElement).value;

    if (!name) return showError("Please enter your name.");
    if (!isValidEmail(email)) return showError("Please enter a valid email address.");
    if (!isValidPhone(phone)) return showError("Please enter a valid phone number (example: 0212345678).");

    submitBtn.disabled = true;
    try {
      const response = await fetch(INTAKE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          source: "quiz",
          hp,
          // Only consulted for localhost dev; in production the endpoint
          // resolves the tenant from the Origin header.
          site: "termdepositrates",
          tracking: collectTracking(),
        }),
      });
      if (!response.ok) {
        submitBtn.disabled = false;
        return showError("We couldn't submit your details. Please check them and try again.");
      }
      dataLayerPush({ event: "quiz_lead_submitted" });
      renderResults();
    } catch {
      submitBtn.disabled = false;
      showError("We couldn't reach the server. Please check your connection and try again.");
    }
  });

  dataLayerPush({ event: "quiz_step_view", quiz_step: 1 });
}

initQuiz();
document.addEventListener("astro:page-load", () => initQuiz());
