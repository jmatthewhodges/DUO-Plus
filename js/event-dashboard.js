/**
 * ============================================================
 * File:            event-dashboard.js
 * Description:     Event dashboard metrics, chart rendering, and report generation.
 *
 * Last Modified By:  Matthew
 * Last Modified On:  April 20 @ 5:16 PM
 * Changes Made:      Standardized formatting and added clarity comments.
 * ============================================================
 */
const API = "/api/event-dashboard.php";

// Cache frequently used DOM nodes up front to keep render functions simple.
const eventSelector = document.getElementById("eventSelector");
const refreshBtn = document.getElementById("refreshDashboardBtn");
const generateReportBtn = document.getElementById("generateReportBtn");
const selectedEventMeta = document.getElementById("selectedEventMeta");
const dashboardEmptyState = document.getElementById("dashboardEmptyState");
const dashboardContent = document.getElementById("dashboardContent");
const serviceOutcomesTableBody = document.getElementById(
  "serviceOutcomesTableBody",
);
const serviceOutcomesChartHint = document.getElementById(
  "serviceOutcomesChartHint",
);
const serviceWaitTimesChartHint = document.getElementById(
  "serviceWaitTimesChartHint",
);
const registrationChoiceCards = document.getElementById(
  "registrationChoiceCards",
);
const registrationChoicesHint = document.getElementById(
  "registrationChoicesHint",
);

// Metric element map lets the API payload keys drive a generic renderer.
const metricElements = {
  totalVisits: document.getElementById("metricTotalVisits"),
  abandoned: document.getElementById("metricAbandoned"),
  translatorNeeded: document.getElementById("metricTranslatorNeeded"),
  clientsServed: document.getElementById("metricClientsServed"),
  volunteersServed: document.getElementById("metricVolunteersServed"),
  chiropractorClientsServed: document.getElementById("metricChiroClients"),
  chiropractorVolunteersServed: document.getElementById(
    "metricChiroVolunteers",
  ),
  volunteerBadgesPrinted: document.getElementById(
    "metricVolunteerBadgesPrinted",
  ),
};

const numberFormatter = new Intl.NumberFormat("en-US");

// Keep chart instances so we can destroy/recreate them cleanly on refresh.
let serviceOutcomesChart = null;
let serviceWaitTimesChart = null;
let registrationChoicesChart = null;
let currentEventID = "";
let latestDashboardSnapshot = null;

// Disable report generation until we have a loaded event snapshot.
function updateReportButtonState(isBusy = false) {
  if (!generateReportBtn) {
    return;
  }

  const hasReportData = Boolean(
    latestDashboardSnapshot && latestDashboardSnapshot.selectedEvent,
  );
  generateReportBtn.disabled = isBusy || !hasReportData;
}

function setBusy(isBusy) {
  if (eventSelector) {
    eventSelector.disabled = isBusy;
  }
  if (refreshBtn) {
    refreshBtn.disabled = isBusy;
    const icon = refreshBtn.querySelector("i");
    if (icon) {
      icon.classList.toggle("spin-refresh", isBusy);
    }
  }

  updateReportButtonState(isBusy);
}

function formatNumber(value) {
  return numberFormatter.format(Number(value || 0));
}

function safeNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatSigned(value, digits = 1) {
  const numericValue = safeNumber(value);
  const sign = numericValue > 0 ? "+" : "";
  return sign + numericValue.toFixed(digits);
}

function getJsPdfCtor() {
  if (!window.jspdf || !window.jspdf.jsPDF) {
    return null;
  }
  return window.jspdf.jsPDF;
}

// Build a PDF document from report text. Shared by preview and download paths.
function buildReportPdfDoc(reportText, eventName) {
  const JsPdf = getJsPdfCtor();
  if (!JsPdf) {
    return null;
  }

  const doc = new JsPdf({
    orientation: "p",
    unit: "pt",
    format: "letter",
  });

  const margin = 44;
  const lineHeight = 14;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.text("Event Summary Report", margin, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.text("Event: " + (eventName || "Selected event"), margin, y);
  y += 14;
  doc.text("Generated: " + new Date().toLocaleString(), margin, y);
  y += 16;

  doc.setDrawColor(222, 226, 230);
  doc.line(margin, y, pageWidth - margin, y);
  y += 14;

  doc.setFontSize(10.5);
  const lines = String(reportText || "").split("\n");

  lines.forEach((line) => {
    const wrapped =
      line.trim() === "" ? [" "] : doc.splitTextToSize(line, contentWidth);

    wrapped.forEach((segment) => {
      if (y > pageHeight - margin) {
        doc.addPage();
        y = margin;
      }

      doc.text(segment, margin, y);
      y += lineHeight;
    });
  });

  return doc;
}

function buildReportFileBase(eventID) {
  const cleanedEventID = String(eventID || "event").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  return cleanedEventID + "-dashboard-report-" + stamp;
}

function buildReportPdfPreviewUrl(reportText, eventName) {
  const doc = buildReportPdfDoc(reportText, eventName);
  if (!doc) {
    return null;
  }

  const blob = doc.output("blob");
  return URL.createObjectURL(blob);
}

function saveReportPdf(reportText, eventID, eventName) {
  const doc = buildReportPdfDoc(reportText, eventName);
  if (!doc) {
    return false;
  }

  doc.save(buildReportFileBase(eventID) + ".pdf");
  return true;
}

function formatEventName(event) {
  if (!event) {
    return "Selected event";
  }

  if (event.label) {
    return event.label;
  }

  const datePart = event.EventDate || "";
  const locationPart = event.LocationName || "";
  const combined = [datePart, locationPart].filter(Boolean).join(" - ");
  if (combined) {
    return combined;
  }

  return event.EventID || "Selected event";
}

// Convert the live dashboard snapshot into a plain-language report.
function buildDashboardReport(snapshot) {
  if (!snapshot || !snapshot.selectedEvent) {
    return "No event data loaded. Select an event and refresh first.";
  }

  const lines = [];
  const metrics = snapshot.metrics || {};
  const serviceOutcomes = snapshot.serviceOutcomes || [];
  const registrationChoices = snapshot.registrationChoices || [];
  const waitComparisons = snapshot.serviceWaitComparisons || [];

  let totalAssigned = 0;
  let totalCompleted = 0;
  let largestGapRow = null;

  serviceOutcomes.forEach((row) => {
    const assigned = safeNumber(row.assignedCount);
    const completed = safeNumber(row.completedCount);
    const gap = Math.max(assigned - completed, 0);

    totalAssigned += assigned;
    totalCompleted += completed;

    if (!largestGapRow || gap > safeNumber(largestGapRow.gap)) {
      largestGapRow = {
        name: row.serviceName || row.serviceID,
        gap,
      };
    }
  });

  const overallCompletionRate =
    totalAssigned > 0 ? (totalCompleted / totalAssigned) * 100 : 0;

  const completionInterpretation =
    overallCompletionRate >= 85
      ? "Completion is strong overall; most assigned services are being finished."
      : overallCompletionRate >= 70
        ? "Completion is moderate; review services with larger unfinished queues."
        : "Completion is low; focus on bottlenecks and staffing at high-gap services.";

  const totalVisits = safeNumber(metrics.totalVisits);
  const abandoned = safeNumber(metrics.abandoned);
  const abandonmentRate = totalVisits > 0 ? (abandoned / totalVisits) * 100 : 0;

  const registrationTotal = registrationChoices.reduce(
    (sum, row) => sum + safeNumber(row.chosenCount),
    0,
  );
  const hasRegistrationPast = registrationChoices.some(
    (row) => row.pastChosenCount !== null && row.pastChosenCount !== undefined,
  );
  const registrationPastTotal = hasRegistrationPast
    ? registrationChoices.reduce(
        (sum, row) => sum + safeNumber(row.pastChosenCount),
        0,
      )
    : 0;
  const registrationDelta = registrationTotal - registrationPastTotal;

  let topRegistrationChoice = null;
  let largestRegistrationGain = null;
  let largestRegistrationDrop = null;
  registrationChoices.forEach((row) => {
    const currentCount = safeNumber(row.chosenCount);
    const pastCount =
      row.pastChosenCount === null || row.pastChosenCount === undefined
        ? null
        : safeNumber(row.pastChosenCount);
    const delta = pastCount === null ? null : currentCount - pastCount;

    if (
      !topRegistrationChoice ||
      currentCount > safeNumber(topRegistrationChoice.count)
    ) {
      topRegistrationChoice = {
        name: row.serviceName || row.serviceID,
        count: currentCount,
      };
    }

    if (delta !== null) {
      if (
        !largestRegistrationGain ||
        delta > safeNumber(largestRegistrationGain.delta)
      ) {
        largestRegistrationGain = {
          name: row.serviceName || row.serviceID,
          delta,
        };
      }

      if (
        !largestRegistrationDrop ||
        delta < safeNumber(largestRegistrationDrop.delta)
      ) {
        largestRegistrationDrop = {
          name: row.serviceName || row.serviceID,
          delta,
        };
      }
    }
  });

  const waitWithSelected = waitComparisons.filter(
    (row) =>
      row.selectedAvgMinutes !== null && row.selectedAvgMinutes !== undefined,
  );
  const waitComparable = waitComparisons.filter(
    (row) =>
      row.selectedAvgMinutes !== null &&
      row.selectedAvgMinutes !== undefined &&
      row.pastAvgMinutes !== null &&
      row.pastAvgMinutes !== undefined,
  );

  const selectedAvgOverall =
    waitWithSelected.length > 0
      ? waitWithSelected.reduce(
          (sum, row) => sum + safeNumber(row.selectedAvgMinutes),
          0,
        ) / waitWithSelected.length
      : 0;

  const pastAvgOverall =
    waitComparable.length > 0
      ? waitComparable.reduce(
          (sum, row) => sum + safeNumber(row.pastAvgMinutes),
          0,
        ) / waitComparable.length
      : 0;

  const overallWaitDelta =
    waitComparable.length > 0 ? selectedAvgOverall - pastAvgOverall : null;
  const fasterOrEqualCount = waitComparable.filter(
    (row) => safeNumber(row.deltaMinutes) <= 0,
  ).length;
  const slowerCount = waitComparable.filter(
    (row) => safeNumber(row.deltaMinutes) > 0,
  ).length;

  let largestSlowdown = null;
  let bestImprovement = null;
  waitComparable.forEach((row) => {
    const delta = safeNumber(row.deltaMinutes);
    const serviceName = row.serviceName || row.serviceID;

    if (!largestSlowdown || delta > safeNumber(largestSlowdown.delta)) {
      largestSlowdown = { name: serviceName, delta };
    }

    if (!bestImprovement || delta < safeNumber(bestImprovement.delta)) {
      bestImprovement = { name: serviceName, delta };
    }
  });

  const generatedAt = snapshot.generatedAt
    ? new Date(snapshot.generatedAt.replace(" ", "T")).toLocaleString()
    : new Date().toLocaleString();

  lines.push("EVENT SUMMARY REPORT");
  lines.push("Event: " + formatEventName(snapshot.selectedEvent));
  lines.push("Generated: " + generatedAt);
  lines.push("");

  lines.push("1) Snapshot Metrics");
  lines.push("- Total visits: " + formatNumber(totalVisits));
  lines.push(
    "- Abandoned visits: " +
      formatNumber(abandoned) +
      " (" +
      abandonmentRate.toFixed(1) +
      "% of visits)",
  );
  lines.push("- Needs translator: " + formatNumber(metrics.translatorNeeded));
  lines.push(
    "- Volunteer badges printed (unique): " +
      formatNumber(metrics.volunteerBadgesPrinted),
  );
  lines.push(
    "- Food truck clients / volunteers: " +
      formatNumber(metrics.clientsServed) +
      " / " +
      formatNumber(metrics.volunteersServed),
  );
  lines.push(
    "- Chiro clients / volunteers: " +
      formatNumber(metrics.chiropractorClientsServed) +
      " / " +
      formatNumber(metrics.chiropractorVolunteersServed),
  );
  lines.push("");

  lines.push("2) Assigned vs Completed");
  lines.push("- Total assigned: " + formatNumber(totalAssigned));
  lines.push("- Total completed: " + formatNumber(totalCompleted));
  lines.push(
    "- Overall completion rate: " + overallCompletionRate.toFixed(1) + "%",
  );
  if (largestGapRow && largestGapRow.gap > 0) {
    lines.push(
      "- Largest unfinished gap: " +
        largestGapRow.name +
        " (" +
        formatNumber(largestGapRow.gap) +
        " not completed)",
    );
  }
  lines.push("- Interpretation: " + completionInterpretation);
  lines.push("");

  lines.push("3) Registration Choices (Step 5)");
  if (topRegistrationChoice) {
    lines.push(
      "- Top selected service: " +
        topRegistrationChoice.name +
        " (" +
        formatNumber(topRegistrationChoice.count) +
        ")",
    );
  } else {
    lines.push("- No registration choice data is available for this event.");
  }

  if (hasRegistrationPast) {
    lines.push(
      "- Total selections vs past event: " +
        formatNumber(registrationTotal) +
        " vs " +
        formatNumber(registrationPastTotal) +
        " (" +
        formatSigned(registrationDelta, 0) +
        ")",
    );
    if (largestRegistrationGain) {
      lines.push(
        "- Largest increase: " +
          largestRegistrationGain.name +
          " (" +
          formatSigned(largestRegistrationGain.delta, 0) +
          ")",
      );
    }
    if (largestRegistrationDrop) {
      lines.push(
        "- Largest decrease: " +
          largestRegistrationDrop.name +
          " (" +
          formatSigned(largestRegistrationDrop.delta, 0) +
          ")",
      );
    }
  } else {
    lines.push(
      "- No past-event registration baseline is available for comparison.",
    );
  }
  lines.push("");

  lines.push("4) Avg Service Time vs Past Event");
  lines.push(
    "- Current event average across services: " +
      selectedAvgOverall.toFixed(1) +
      " min",
  );
  if (overallWaitDelta !== null) {
    lines.push(
      "- Past event average across comparable services: " +
        pastAvgOverall.toFixed(1) +
        " min",
    );
    lines.push(
      "- Net change vs past: " + formatSigned(overallWaitDelta, 1) + " min",
    );
    lines.push(
      "- Services faster/equal: " +
        formatNumber(fasterOrEqualCount) +
        "; services slower: " +
        formatNumber(slowerCount),
    );
    if (largestSlowdown && largestSlowdown.delta > 0) {
      lines.push(
        "- Biggest slowdown: " +
          largestSlowdown.name +
          " (" +
          formatSigned(largestSlowdown.delta, 1) +
          " min)",
      );
    }
    if (bestImprovement && bestImprovement.delta < 0) {
      lines.push(
        "- Biggest improvement: " +
          bestImprovement.name +
          " (" +
          formatSigned(bestImprovement.delta, 1) +
          " min)",
      );
    }
  } else {
    lines.push(
      "- Past-event service time data is not available for comparison.",
    );
  }
  lines.push("");

  lines.push("5) What This Means");
  if (overallCompletionRate < 70) {
    lines.push(
      "- Priority: reduce unfinished services first; completion is below target.",
    );
  } else if (overallCompletionRate < 85) {
    lines.push(
      "- Priority: improve completion consistency in high-gap services.",
    );
  } else {
    lines.push(
      "- Throughput is healthy; maintain staffing patterns that support completion.",
    );
  }

  if (overallWaitDelta !== null && overallWaitDelta > 0.5) {
    lines.push(
      "- Wait times are trending slower than the past event; review flow in the slowdown services.",
    );
  } else if (overallWaitDelta !== null && overallWaitDelta < -0.5) {
    lines.push(
      "- Wait times improved versus past event; current process changes appear effective.",
    );
  }

  if (abandonmentRate > 15) {
    lines.push(
      "- Abandonment is elevated; consider front-desk triage or expectation-setting at check-in.",
    );
  }

  return lines.join("\n");
}

// Show a preview-first report flow so staff can review before downloading.
async function showGeneratedReport(reportText, eventID) {
  const hasPdfSupport = Boolean(getJsPdfCtor());
  const eventName =
    latestDashboardSnapshot && latestDashboardSnapshot.selectedEvent
      ? formatEventName(latestDashboardSnapshot.selectedEvent)
      : "Selected event";

  if (!hasPdfSupport) {
    if (typeof Swal !== "undefined") {
      await Swal.fire({
        icon: "error",
        title: "PDF unavailable",
        text: "PDF engine failed to load. Refresh and try again.",
      });
    } else {
      alert("PDF engine failed to load. Refresh and try again.");
    }
    return;
  }

  if (typeof Swal === "undefined") {
    saveReportPdf(reportText, eventID, eventName);
    return;
  }

  const previewUrl = buildReportPdfPreviewUrl(reportText, eventName);
  if (!previewUrl) {
    await Swal.fire({
      icon: "error",
      title: "PDF preview failed",
      text: "Could not generate the PDF preview. Try again.",
    });
    return;
  }

  const result = await Swal.fire({
    title: "Event Report PDF",
    width: 960,
    html:
      '<div class="text-start">' +
      '<p class="small text-muted mb-2">Previewing the generated report as PDF.</p>' +
      '<iframe title="Report PDF Preview" src="' +
      previewUrl +
      '" style="width:100%; height:65vh; border:1px solid #e2e8f0; border-radius:8px; background:#fff;"></iframe>' +
      "</div>",
    showConfirmButton: true,
    confirmButtonText: "Download PDF",
    showCancelButton: true,
    cancelButtonText: "Close",
    willClose() {
      URL.revokeObjectURL(previewUrl);
    },
  });

  if (result.isConfirmed) {
    saveReportPdf(reportText, eventID, eventName);
  }
}

function updateUrlEvent(eventID) {
  const url = new URL(window.location.href);
  if (eventID) {
    url.searchParams.set("eventID", eventID);
  } else {
    url.searchParams.delete("eventID");
  }
  window.history.replaceState({}, "", url.toString());
}

// Render event dropdown options and keep selected option in sync with payload.
function renderEvents(events, selectedEvent) {
  if (!eventSelector) {
    return;
  }

  eventSelector.innerHTML = "";

  events.forEach((event) => {
    const opt = document.createElement("option");
    opt.value = event.EventID;
    opt.textContent = event.label || event.EventID;
    if (selectedEvent && selectedEvent.EventID === event.EventID) {
      opt.selected = true;
    }
    eventSelector.appendChild(opt);
  });
}

function renderEventMeta(event) {
  if (!selectedEventMeta) {
    return;
  }

  if (!event) {
    selectedEventMeta.textContent = "No event selected.";
    return;
  }

  const datePart = event.EventDate || "No date";
  const locationPart = event.LocationName || "No location";
  const activePart = Number(event.IsActive) === 1 ? " | Active event" : "";
  selectedEventMeta.textContent = datePart + " | " + locationPart + activePart;
}

// Generic metric rendering keyed by metricElements.
function renderMetrics(metrics) {
  Object.entries(metricElements).forEach(([key, el]) => {
    if (!el) return;
    el.textContent = formatNumber(metrics[key]);
  });
}

// Service outcomes table renderer used by every dashboard refresh.
function renderServiceOutcomes(rows) {
  if (!serviceOutcomesTableBody) {
    return;
  }

  if (!rows || rows.length === 0) {
    serviceOutcomesTableBody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center py-4 text-muted">No service outcome data for this event.</td>
            </tr>`;
    return;
  }

  serviceOutcomesTableBody.innerHTML = rows
    .map((row) => {
      const completionRate = Number(row.completionRate || 0);

      return `
            <tr>
                <td class="ps-3 fw-semibold">${row.serviceName || row.serviceID}</td>
                <td>${formatNumber(row.assignedCount)}</td>
                <td>${formatNumber(row.completedCount)}</td>
                <td><span class="rate-pill">${completionRate.toFixed(1)}%</span></td>
                <td class="pe-3">${formatNumber(row.notCompletedCount)}</td>
            </tr>`;
    })
    .join("");
}

// Chart lifecycle helpers.
function destroyCharts() {
  if (serviceOutcomesChart) {
    serviceOutcomesChart.destroy();
    serviceOutcomesChart = null;
  }
  if (serviceWaitTimesChart) {
    serviceWaitTimesChart.destroy();
    serviceWaitTimesChart = null;
  }
  if (registrationChoicesChart) {
    registrationChoicesChart.destroy();
    registrationChoicesChart = null;
  }
}

function getChartCanvas(hostId) {
  const chartHost = document.getElementById(hostId);
  if (!chartHost) {
    return null;
  }

  let canvas = chartHost.querySelector("canvas");
  if (!canvas) {
    chartHost.innerHTML = "";
    canvas = document.createElement("canvas");
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", hostId + " chart");
    chartHost.appendChild(canvas);
  }

  return canvas;
}

// Registration choices are rendered as both cards and an optional comparison chart.
function renderRegistrationChoiceCards(rows) {
  if (!registrationChoiceCards) {
    return;
  }

  if (!rows || rows.length === 0) {
    registrationChoiceCards.innerHTML =
      '<div class="text-muted small">No registration choice data.</div>';
    return;
  }

  const hasPastComparison = rows.some(
    (row) => row.pastChosenCount !== null && row.pastChosenCount !== undefined,
  );

  registrationChoiceCards.innerHTML = rows
    .map((row) => {
      const selectedCount = Number(row.chosenCount || 0);
      const pastCount =
        row.pastChosenCount === null || row.pastChosenCount === undefined
          ? null
          : Number(row.pastChosenCount || 0);
      const delta = pastCount === null ? null : selectedCount - pastCount;

      let deltaBadge = "";
      if (delta !== null) {
        const deltaPrefix = delta > 0 ? "+" : "";
        const deltaClass =
          delta > 0
            ? "bg-danger-subtle text-danger border-danger-subtle"
            : delta < 0
              ? "bg-success-subtle text-success border-success-subtle"
              : "bg-secondary-subtle text-secondary border-secondary-subtle";
        deltaBadge = `<span class="badge border ${deltaClass}">${deltaPrefix}${formatNumber(delta)}</span>`;
      }

      return `
        <div class="border rounded p-2 px-3 d-flex align-items-center justify-content-between gap-2">
            <div class="d-flex flex-column">
                <span class="fw-semibold small">${row.serviceName || row.serviceID}</span>
                <span class="text-muted" style="font-size:0.72rem;">
                    Selected: ${formatNumber(selectedCount)}${hasPastComparison ? ` | Past: ${pastCount === null ? "N/A" : formatNumber(pastCount)}` : ""}
                </span>
            </div>
            <div class="d-flex align-items-center gap-1">
                <span class="badge bg-primary-subtle text-primary border border-primary-subtle">${formatNumber(selectedCount)}</span>
                ${deltaBadge}
            </div>
        </div>
    `;
    })
    .join("");
}

function renderRegistrationChoices(rows) {
  renderRegistrationChoiceCards(rows);

  if (!registrationChoicesHint) {
    return;
  }

  if (typeof Chart === "undefined") {
    registrationChoicesHint.textContent = "Chart library failed to load.";
    return;
  }

  const safeRows = rows || [];
  const labels = safeRows.map((row) => row.serviceName || row.serviceID);
  const selectedSeries = safeRows.map((row) => Number(row.chosenCount || 0));
  const pastSeries = safeRows.map((row) => {
    if (row.pastChosenCount === null || row.pastChosenCount === undefined) {
      return 0;
    }
    return Number(row.pastChosenCount || 0);
  });
  const hasPastComparison = safeRows.some(
    (row) => row.pastChosenCount !== null && row.pastChosenCount !== undefined,
  );

  const chartHost = document.getElementById("registrationChoicesChart");
  if (!chartHost) {
    return;
  }

  if (labels.length === 0) {
    registrationChoicesHint.textContent =
      "No registration step-5 selections for this event yet.";
    if (registrationChoicesChart) {
      registrationChoicesChart.destroy();
      registrationChoicesChart = null;
    }
    chartHost.innerHTML = "";
    return;
  }

  registrationChoicesHint.textContent = hasPastComparison
    ? "Comparing selected event choices against previous event choices."
    : "No prior event found for comparison.";

  if (registrationChoicesChart) {
    registrationChoicesChart.destroy();
  }

  const canvas = getChartCanvas("registrationChoicesChart");
  if (!canvas) {
    return;
  }

  registrationChoicesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Chosen At Registration",
          data: selectedSeries,
          backgroundColor: "#1d4ed8",
          borderRadius: 8,
          maxBarThickness: 44,
        },
        ...(hasPastComparison
          ? [
              {
                label: "Past Event Choices",
                data: pastSeries,
                backgroundColor: "#94a3b8",
                borderRadius: 8,
                maxBarThickness: 44,
              },
            ]
          : []),
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: hasPastComparison,
          position: "top",
          align: "start",
        },
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
          },
        },
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          grid: {
            color: "#edf1f5",
          },
        },
      },
    },
  });
}

// Horizontal bar chart comparing assigned vs completed counts per service.
function renderServiceOutcomesChart(data) {
  if (typeof Chart === "undefined") {
    serviceOutcomesChartHint.textContent = "Chart library failed to load.";
    return;
  }

  const labels = data.labels || [];
  const assigned = (data.assigned || []).map((value) => Number(value || 0));
  const completed = (data.completed || []).map((value) => Number(value || 0));

  if (labels.length === 0) {
    serviceOutcomesChartHint.textContent =
      "No service outcome records for this event yet.";
    if (serviceOutcomesChart) {
      serviceOutcomesChart.destroy();
      serviceOutcomesChart = null;
    }
    document.getElementById("serviceOutcomesChart").innerHTML = "";
    return;
  }

  serviceOutcomesChartHint.textContent = "";

  if (serviceOutcomesChart) {
    serviceOutcomesChart.destroy();
  }

  const canvas = getChartCanvas("serviceOutcomesChart");
  if (!canvas) {
    return;
  }

  serviceOutcomesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Assigned",
          data: assigned,
          backgroundColor: "#94a3b8",
          borderRadius: 8,
          maxBarThickness: 20,
        },
        {
          label: "Completed",
          data: completed,
          backgroundColor: "#228b22",
          borderRadius: 8,
          maxBarThickness: 20,
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
          align: "start",
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: {
            precision: 0,
          },
          grid: {
            color: "#edf1f5",
          },
        },
        y: {
          grid: {
            display: false,
          },
          ticks: {
            font: {
              size: 11,
            },
          },
        },
      },
    },
  });
}

// Service-time chart compares current event averages against the previous event.
function renderServiceWaitTimesChart(data) {
  if (!serviceWaitTimesChartHint) {
    return;
  }

  if (typeof Chart === "undefined") {
    serviceWaitTimesChartHint.textContent = "Chart library failed to load.";
    return;
  }

  const labels = data.labels || [];
  const selectedSeries = (data.selectedAvgMinutes || []).map((value) =>
    Number(value || 0),
  );
  const pastSeries = (data.pastAvgMinutes || []).map((value) =>
    Number(value || 0),
  );
  const pastEventID = data.pastEventID || null;

  if (labels.length === 0) {
    serviceWaitTimesChartHint.textContent =
      "No service time records found for this event.";
    if (serviceWaitTimesChart) {
      serviceWaitTimesChart.destroy();
      serviceWaitTimesChart = null;
    }
    const chartHost = document.getElementById("serviceWaitTimesChart");
    if (chartHost) {
      chartHost.innerHTML = "";
    }
    return;
  }

  const hasPastComparison = Boolean(
    pastEventID &&
    pastSeries.some((value) => Number.isFinite(value) && value > 0),
  );

  if (!hasPastComparison) {
    serviceWaitTimesChartHint.textContent =
      "Showing selected-event average service times.";
  } else {
    serviceWaitTimesChartHint.textContent =
      "Selected bars are green when faster than past avg and red when slower.";
  }

  if (serviceWaitTimesChart) {
    serviceWaitTimesChart.destroy();
  }

  const canvas = getChartCanvas("serviceWaitTimesChart");
  if (!canvas) {
    return;
  }

  const selectedColors = selectedSeries.map((value, index) => {
    const pastValue = Number(pastSeries[index]);
    if (!hasPastComparison || !Number.isFinite(pastValue) || pastValue <= 0) {
      return "#0f766e";
    }
    return value <= pastValue ? "#228b22" : "#b91c1c";
  });

  const datasets = [
    {
      label: "Selected Event Avg",
      data: selectedSeries,
      backgroundColor: selectedColors,
      borderRadius: 8,
      barThickness: 18,
      maxBarThickness: 22,
    },
  ];

  if (hasPastComparison) {
    datasets.push({
      label: "Past Event Avg",
      data: pastSeries,
      backgroundColor: "#cbd5e1",
      borderRadius: 8,
      barThickness: 18,
      maxBarThickness: 22,
    });
  }

  serviceWaitTimesChart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets,
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: hasPastComparison,
          position: "top",
          align: "start",
        },
        tooltip: {
          callbacks: {
            label(context) {
              const selected = Number(context.raw || 0);
              const past = Number(pastSeries[context.dataIndex]);
              if (context.datasetIndex === 1) {
                return "Past: " + selected.toFixed(1) + " min";
              }
              if (hasPastComparison && Number.isFinite(past)) {
                const delta = selected - past;
                const relation = delta <= 0 ? "faster/equal" : "slower";
                const deltaPrefix = delta > 0 ? "+" : "";
                return (
                  "Selected: " +
                  selected.toFixed(1) +
                  " min (Past: " +
                  past.toFixed(1) +
                  ", " +
                  deltaPrefix +
                  delta.toFixed(1) +
                  ", " +
                  relation +
                  ")"
                );
              }
              return "Selected: " + selected.toFixed(1) + " min";
            },
          },
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          grid: {
            color: "#e2e8f0",
          },
          border: {
            display: true,
          },
          ticks: {
            maxTicksLimit: 6,
            callback(value) {
              return value + "m";
            },
          },
        },
        y: {
          grid: {
            display: false,
          },
          border: {
            display: false,
          },
          ticks: {
            color: "#0f172a",
            font: {
              size: 12,
              weight: "600",
            },
          },
        },
      },
    },
  });
}

function showEmptyState(show) {
  if (dashboardEmptyState) {
    dashboardEmptyState.classList.toggle("d-none", !show);
  }
  if (dashboardContent) {
    dashboardContent.classList.toggle("d-none", show);
  }
}

// Main dashboard load pipeline: fetch, normalize payload, then render all sections.
async function loadDashboard(eventID = "") {
  setBusy(true);

  try {
    const url = new URL(API, window.location.origin);
    if (eventID) {
      url.searchParams.set("eventID", eventID);
    }

    const response = await fetch(url.toString());
    const data = await response.json();

    if (!response.ok || !data.success) {
      throw new Error(
        data.error || data.message || "Failed to load dashboard data.",
      );
    }

    const events = data.events || [];
    const selectedEvent = data.selectedEvent || null;

    showEmptyState(events.length === 0);
    renderEvents(events, selectedEvent);

    if (!selectedEvent) {
      latestDashboardSnapshot = null;
      destroyCharts();
      renderEventMeta(null);
      renderMetrics({});
      renderServiceOutcomes([]);
      renderServiceWaitTimesChart({
        labels: [],
        selectedAvgMinutes: [],
        pastAvgMinutes: [],
        pastEventID: null,
      });
      renderRegistrationChoices([]);
      updateUrlEvent("");
      currentEventID = "";
      return;
    }

    currentEventID = selectedEvent.EventID;
    latestDashboardSnapshot = {
      selectedEvent,
      metrics: data.metrics || {},
      registrationChoices: data.registrationChoices || [],
      serviceOutcomes: data.serviceOutcomes || [],
      serviceWaitComparisons: data.serviceWaitComparisons || [],
      generatedAt: data.generatedAt || null,
    };
    updateUrlEvent(currentEventID);
    renderEventMeta(selectedEvent);
    renderMetrics(data.metrics || {});
    renderRegistrationChoices(data.registrationChoices || []);
    renderServiceOutcomes(data.serviceOutcomes || []);
    renderServiceWaitTimesChart(
      (data.charts || {}).serviceWaitTimes || {
        labels: [],
        selectedAvgMinutes: [],
        pastAvgMinutes: [],
        pastEventID: null,
      },
    );
    renderServiceOutcomesChart(
      (data.charts || {}).serviceOutcomes || {
        labels: [],
        assigned: [],
        completed: [],
      },
    );
  } catch (err) {
    latestDashboardSnapshot = null;
    destroyCharts();
    showEmptyState(false);
    if (typeof Swal !== "undefined") {
      Swal.fire({
        icon: "error",
        title: "Dashboard Load Error",
        text: err.message,
      });
    } else {
      alert(err.message);
    }
  } finally {
    setBusy(false);
  }
}

// UI event wiring for selector changes, refresh, and report generation.
function bindEvents() {
  if (eventSelector) {
    eventSelector.addEventListener("change", () => {
      const nextID = eventSelector.value || "";
      loadDashboard(nextID);
    });
  }

  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      loadDashboard(currentEventID);
    });
  }

  if (generateReportBtn) {
    generateReportBtn.addEventListener("click", async () => {
      if (!latestDashboardSnapshot || !latestDashboardSnapshot.selectedEvent) {
        if (typeof Swal !== "undefined") {
          Swal.fire({
            icon: "info",
            title: "No data loaded",
            text: "Select an event first, then generate the report.",
          });
        } else {
          alert("Select an event first, then generate the report.");
        }
        return;
      }

      const reportText = buildDashboardReport(latestDashboardSnapshot);
      await showGeneratedReport(
        reportText,
        latestDashboardSnapshot.selectedEvent.EventID,
      );
    });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  bindEvents();
  const url = new URL(window.location.href);
  const eventFromQuery = url.searchParams.get("eventID") || "";
  loadDashboard(eventFromQuery);
});
