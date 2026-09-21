/** Shared client ping sender and waiting-room notification display. */

const CLIENT_PING_ENDPOINT = "../api/ClientPing.php";
const CLIENT_PING_STORAGE_KEY = "duo-plus-last-client-ping";
const DISMISSED_CLIENT_PING_STORAGE_KEY = "duo-plus-dismissed-client-pings";

function getDismissedClientPingIds() {
  try {
    const value = JSON.parse(
      localStorage.getItem(DISMISSED_CLIENT_PING_STORAGE_KEY) || "[]",
    );
    return new Set(Array.isArray(value) ? value : []);
  } catch {
    return new Set();
  }
}

window.dismissClientPing = (pingId) => {
  if (!pingId) return;
  const dismissed = getDismissedClientPingIds();
  dismissed.add(pingId);
  localStorage.setItem(
    DISMISSED_CLIENT_PING_STORAGE_KEY,
    JSON.stringify([...dismissed].slice(-100)),
  );
};

function showClientPingAlert(ping) {
  if (!ping) return;
  if (typeof window.setActiveClientPing === "function") {
    window.setActiveClientPing?.(ping);
  }
}

async function sendClientPing(serviceName, serviceId = "") {
  const response = await fetch(CLIENT_PING_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ serviceName, serviceId }),
  });
  const data = await response.json();
  if (!response.ok || !data.success) {
    throw new Error(data.message || data.error || "Unable to send client ping.");
  }
  return data;
}

async function chooseDentalPingService(service) {
  const dentalOptions = (service.serviceIDs || [])
    .map((serviceId) => ({
      id: serviceId,
      label:
        typeof SUB_SERVICE_LABELS !== "undefined" && SUB_SERVICE_LABELS[serviceId]
          ? /extraction/i.test(serviceId) || /extraction/i.test(SUB_SERVICE_LABELS[serviceId])
            ? "Extraction"
            : "Cleaning"
          : typeof SERVICE_NAME_BY_ID !== "undefined" && SERVICE_NAME_BY_ID[serviceId]
            ? /extraction/i.test(serviceId) || /extraction/i.test(SERVICE_NAME_BY_ID[serviceId])
              ? "Extraction"
              : "Cleaning"
            : serviceId,
    }))
    .filter(({ id, label }) =>
      /hygiene|extraction/i.test(id) || /cleaning|extraction/i.test(label),
    );

  if (!dentalOptions.length) return null;

  const inputOptions = Object.fromEntries(
    dentalOptions.map(({ id, label }) => [id, label]),
  );
  const result = await Swal.fire({
    title: "Which client is needed?",
    input: "radio",
    inputOptions,
    inputValidator: (value) => (!value ? "Choose a dental service." : undefined),
    showCancelButton: true,
    confirmButtonText: "Send Ping",
    cancelButtonText: "Cancel",
  });

  if (!result.isConfirmed) return null;
  const selected = dentalOptions.find(({ id }) => id === result.value);
  const serviceName = selected?.label || "Dental";
  return selected
    ? {
        serviceId: selected.id,
        serviceName: /^dental\b/i.test(serviceName)
          ? serviceName
          : `Dental ${serviceName}`,
      }
    : null;
}

async function handleClientPingClick() {
  const service = typeof currentServiceKey !== "undefined" ? SERVICES[currentServiceKey] : null;
  if (!service) return;

  let pingService = { serviceId: currentServiceKey, serviceName: service.name };
  if (currentServiceKey.toLowerCase() === "dental") {
    pingService = await chooseDentalPingService(service);
    if (!pingService) return;
  }

  const button = document.getElementById("clientPingBtn");
  if (button) button.disabled = true;
  try {
    await sendClientPing(pingService.serviceName, pingService.serviceId);
    Swal.fire({
      icon: "success",
      title: "Client Ping Sent",
      text: `${pingService.serviceName} needs a client.`,
      timer: 1800,
      showConfirmButton: false,
    });
  } catch (error) {
    Swal.fire({ icon: "error", title: "Ping Failed", text: error.message });
  } finally {
    if (button) button.disabled = false;
  }
}

async function checkForClientPing() {
  try {
    const response = await fetch(CLIENT_PING_ENDPOINT, { cache: "no-store" });
    const data = await response.json();
    if (!data.success) return;
    const pings = Array.isArray(data.pings)
      ? data.pings
      : data.ping
        ? [data.ping]
        : [];
    let seenIds = [];
    try {
      seenIds = JSON.parse(localStorage.getItem(CLIENT_PING_STORAGE_KEY) || "[]");
    } catch {
      seenIds = [];
    }
    const seen = new Set(Array.isArray(seenIds) ? seenIds : []);
    const dismissed = getDismissedClientPingIds();
    pings.forEach((ping) => {
      if (dismissed.has(ping.id)) return;
      showClientPingAlert(ping);
      seen.add(ping.id);
    });
    localStorage.setItem(
      CLIENT_PING_STORAGE_KEY,
      JSON.stringify([...seen].slice(-100)),
    );
  } catch (error) {
    console.error("Client ping check failed:", error);
  }
}

const clientPingButton = document.getElementById("clientPingBtn");
if (clientPingButton) clientPingButton.addEventListener("click", handleClientPingClick);