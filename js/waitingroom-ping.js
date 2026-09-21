/** Shared client ping sender and waiting-room notification display. */

const CLIENT_PING_ENDPOINT = "../api/ClientPing.php";
const CLIENT_PING_STORAGE_KEY = "duo-plus-last-client-ping";

function showClientPingAlert(ping) {
  if (!ping || typeof Swal === "undefined") return;

  Swal.fire({
    icon: "info",
    title: "Client Needed",
    text: `${ping.serviceName} needs a client.`,
    timer: 5000,
    timerProgressBar: true,
    showConfirmButton: false,
  });
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
          ? SUB_SERVICE_LABELS[serviceId]
          : typeof SERVICE_NAME_BY_ID !== "undefined" && SERVICE_NAME_BY_ID[serviceId]
            ? SERVICE_NAME_BY_ID[serviceId]
            : serviceId,
    }))
    .filter(({ label }) => /hygiene|extraction/i.test(label));

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
    if (!data.success || !data.ping || data.ping.id === localStorage.getItem(CLIENT_PING_STORAGE_KEY)) return;
    localStorage.setItem(CLIENT_PING_STORAGE_KEY, data.ping.id);
    showClientPingAlert(data.ping);
  } catch (error) {
    console.error("Client ping check failed:", error);
  }
}

const clientPingButton = document.getElementById("clientPingBtn");
if (clientPingButton) clientPingButton.addEventListener("click", handleClientPingClick);