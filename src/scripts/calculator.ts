/**
 * Term-deposit calculator island — vanilla port of
 * term_deposit_calculator_controller.js (Stimulus). Behaviour is preserved
 * 1:1, including loading Chart.js from the CDN on demand.
 */

type RatesData = Record<string, Record<string, number>>;
type Calc = { bank: string; rate: number; interest: number; total: number };

declare const Chart: any;

function loadChartJS(): Promise<void> {
  if (typeof Chart !== "undefined") return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.js";
    script.onload = () => resolve();
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-NZ", {
    style: "currency",
    currency: "NZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function getOrdinalSuffix(num: number): string {
  const j = num % 10;
  const k = num % 100;
  if (j === 1 && k !== 11) return "st";
  if (j === 2 && k !== 12) return "nd";
  if (j === 3 && k !== 13) return "rd";
  return "th";
}

function convertTermToYears(termString: string): number {
  if (termString.includes("mths")) {
    return parseInt(termString.replace(" mths", ""), 10) / 12;
  } else if (termString.includes("years")) {
    return parseInt(termString.replace(" years", ""), 10);
  }
  return 1; // fallback
}

function compoundInterest(principal: number, rate: number, frequency: number, time: number): number {
  return principal * Math.pow(1 + rate / frequency, frequency * time);
}

async function initCalculator(): Promise<void> {
  const root = document.querySelector<HTMLElement>("[data-calculator]");
  if (!root || (root as any)._calcInit) return;
  (root as any)._calcInit = true;

  const dataEl = root.querySelector<HTMLScriptElement>("#calc-data");
  const rates: RatesData = dataEl ? JSON.parse(dataEl.textContent || "{}") : {};

  const depositAmount = root.querySelector<HTMLInputElement>("#deposit-amount")!;
  const termLength = root.querySelector<HTMLSelectElement>("#term-length")!;
  const selectedBank = root.querySelector<HTMLSelectElement>("#bank-select")!;
  const paymentFrequency = root.querySelector<HTMLSelectElement>("#payment-frequency")!;
  const totalReturnEl = root.querySelector<HTMLElement>("[data-calc=totalReturn]")!;
  const interestEarnedEl = root.querySelector<HTMLElement>("[data-calc=interestEarned]")!;
  const rateBreakdownEl = root.querySelector<HTMLElement>("[data-calc=rateBreakdown]")!;
  const chartCanvas = root.querySelector<HTMLCanvasElement>("[data-calc=chart]")!;
  const chartTitleEl = root.querySelector<HTMLElement>("[data-calc=chartTitle]")!;

  let chart: any = null;

  function getRelevantRates(term: string, bank: string): { bank: string; rate: number }[] {
    const out: { bank: string; rate: number }[] = [];
    if (bank) {
      if (rates[bank] && rates[bank][term]) out.push({ bank, rate: rates[bank][term] });
    } else {
      Object.keys(rates).forEach((b) => {
        if (rates[b][term]) out.push({ bank: b, rate: rates[b][term] });
      });
    }
    return out;
  }

  function calculateInterest(principal: number, annualRate: number, termString: string, frequency: string): number {
    const rate = annualRate / 100;
    const termYears = convertTermToYears(termString);
    switch (frequency) {
      case "monthly":
        return compoundInterest(principal, rate, 12, termYears) - principal;
      case "quarterly":
        return compoundInterest(principal, rate, 4, termYears) - principal;
      case "annually":
        return compoundInterest(principal, rate, 1, termYears) - principal;
      case "maturity":
      default:
        return principal * rate * termYears;
    }
  }

  function updateRateBreakdown(calculations: Calc[]): void {
    const bank = selectedBank.value;
    const displayLimit = bank ? 1 : calculations.length;
    const breakdown = calculations
      .slice(0, displayLimit)
      .map((calc, index) => {
        const rankClass = index === 0 ? "border-green-200 bg-green-50" : "border-gray-200 bg-white";
        const rankLabel = index === 0 ? "Best Rate" : `${index + 1}${getOrdinalSuffix(index + 1)}`;
        return `
        <div class="border ${rankClass} rounded-lg p-4">
          <div class="flex justify-between items-center">
            <div>
              <div class="font-medium text-gray-900">${calc.bank}</div>
              <div class="text-sm text-gray-600">${rankLabel}</div>
            </div>
            <div class="text-right">
              <div class="font-bold text-lg ${index === 0 ? "text-green-600" : "text-gray-900"}">${calc.rate}%</div>
              <div class="text-sm text-gray-600">${formatCurrency(calc.total)}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    if (calculations.length === 0) {
      rateBreakdownEl.innerHTML = `
        <div class="text-center text-gray-500 py-8">
          <p>No rates available for selected criteria</p>
        </div>
      `;
    } else {
      const containerClass = calculations.length > 6 ? "max-h-96 overflow-y-auto space-y-3" : "space-y-3";
      rateBreakdownEl.innerHTML = `<div class="${containerClass}">${breakdown}</div>`;
    }
  }

  function updateDisplay(totalReturn: number, interestEarned: number, calculations: Calc[]): void {
    totalReturnEl.textContent = formatCurrency(totalReturn);
    interestEarnedEl.textContent = formatCurrency(interestEarned);
    updateRateBreakdown(calculations);
  }

  function generateChartData(principal: number, rate: number, termString: string) {
    const termYears = convertTermToYears(termString);
    const termMonths = Math.round(termYears * 12);
    const monthlyRate = rate / 100 / 12;
    const labels: number[] = [];
    const simpleInterestData: number[] = [];
    const compoundInterestData: number[] = [];
    for (let month = 0; month <= termMonths; month++) {
      labels.push(month);
      const simple = Math.round(principal + principal * (rate / 100) * (month / 12));
      simpleInterestData.push(simple);
      const compound = month === 0 ? Math.round(principal) : Math.round(principal * Math.pow(1 + monthlyRate, month));
      compoundInterestData.push(compound);
    }
    return { labels, simpleInterestData, compoundInterestData };
  }

  function updateChart(principal: number, rate: number, termString: string, bankName: string | null = null): void {
    if (!chart) return;
    const bank = selectedBank.value;
    let title = "Balance Growth Over Time";
    if (bank && bankName) title = `Balance Growth Over Time - ${bankName} (${rate}%)`;
    else if (rate > 0) title = `Balance Growth Over Time - Best Rate (${rate}%)`;
    chartTitleEl.textContent = title;

    const chartData = generateChartData(principal, rate, termString);
    chart.data.labels = chartData.labels;
    chart.data.datasets[0].data = chartData.simpleInterestData;
    chart.data.datasets[1].data = chartData.compoundInterestData;
    chart.update();
  }

  function calculate(): void {
    const amount = parseFloat(depositAmount.value) || 0;
    const term = termLength.value || "12 mths";
    const bank = selectedBank.value;
    const frequency = paymentFrequency.value;

    if (amount <= 0) {
      updateDisplay(0, 0, []);
      updateChart(0, 0, term, null);
      return;
    }

    const relevantRates = getRelevantRates(term, bank);
    if (relevantRates.length === 0) {
      updateDisplay(amount, 0, []);
      updateChart(amount, 0, term, null);
      return;
    }

    const calculations: Calc[] = relevantRates.map((r) => {
      const interest = calculateInterest(amount, r.rate, term, frequency);
      return { bank: r.bank, rate: r.rate, interest, total: amount + interest };
    });
    calculations.sort((a, b) => b.total - a.total);

    const bestRate = calculations[0];
    updateDisplay(bestRate.total, bestRate.interest, calculations);
    const bankForChart = bank ? bank : bestRate.bank;
    updateChart(amount, bestRate.rate, term, bankForChart);
  }

  function initializeChart(): void {
    if (typeof Chart === "undefined") return;
    const ctx = chartCanvas.getContext("2d");
    chart = new Chart(ctx, {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Simple Interest (At Maturity)",
            data: [],
            borderColor: "#3B82F6",
            backgroundColor: "rgba(59, 130, 246, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.1,
          },
          {
            label: "Compound Interest (Regular Payments)",
            data: [],
            borderColor: "#10B981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            borderWidth: 2,
            fill: false,
            tension: 0.1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: { display: false },
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context: any) => context.dataset.label + ": $" + context.parsed.y.toLocaleString(),
            },
          },
        },
        scales: {
          x: { title: { display: true, text: "Time (Months)" } },
          y: {
            title: { display: true, text: "Balance (NZD)" },
            ticks: { callback: (value: any) => "$" + value.toLocaleString() },
          },
        },
        interaction: { intersect: false, mode: "index" },
      },
    });
  }

  // Wire up events and run the initial calculation.
  depositAmount.addEventListener("input", calculate);
  termLength.addEventListener("change", calculate);
  selectedBank.addEventListener("change", calculate);
  paymentFrequency.addEventListener("change", calculate);

  await loadChartJS();
  initializeChart();
  calculate();
}

initCalculator();
document.addEventListener("astro:page-load", () => initCalculator());
