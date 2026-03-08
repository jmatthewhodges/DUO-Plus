/**
 * ============================================================
 * File:           registrationdashboard.js
 * Description:    Handles managing the registration dashboard.
 *
 * Last Modified By:  Skyler
 * Last Modified On:  Mar 4
 * Changes Made:      Icon updates, code simplification
 * ============================================================
*/

// -- Global Settings & State ---------------------------------

// Service hierarchy — loaded from API at init
let serviceCategories = [];   // [{ ServiceID, ServiceName, IconTag, SortOrder, children: [...] }]
let serviceAvailability = {};  // { categoryID: true/false }

// Service configuration mapping operational ServiceID to display info
// Built dynamically from hierarchy API response
let serviceMapping = {};

// Loads the service hierarchy and builds serviceCategories, serviceAvailability, serviceMapping
async function loadServiceHierarchyForDashboard() {
    try {
        const res = await fetch('/api/services.php?view=hierarchy');
        const json = await res.json();
        if (!json.success || !json.hierarchy) return;

        serviceCategories = json.hierarchy;
        serviceAvailability = {};
        serviceMapping = {};

        serviceCategories.forEach(cat => {
            serviceAvailability[cat.ServiceID] = true; // updated by API availability later

            if (cat.children && cat.children.length > 0) {
                cat.children.forEach(child => {
                    const containerId = 'service-' + child.ServiceID.replace(/([A-Z])/g, '-$1').toLowerCase();
                    // Strip parent name prefix from child (e.g. "Medical Exam" → "Exam")
                    let shortName = child.ServiceName;
                    if (shortName.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                        shortName = shortName.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                    }
                    serviceMapping[child.ServiceID] = {
                        containerId: containerId,
                        displayName: cat.ServiceName + ' - ' + (shortName || child.ServiceName),
                    };
                });
            } else {
                // Standalone category (no children)
                const containerId = 'service-' + cat.ServiceID;
                serviceMapping[cat.ServiceID] = {
                    containerId: containerId,
                    displayName: cat.ServiceName,
                };
            }
        });
    } catch (err) {
        console.error('Failed to load service hierarchy:', err);
    }
}

// Builds the service progress bar elements in the Availability card
function buildServiceProgressBars() {
    const container = document.getElementById('serviceProgressContainer');
    if (!container) return;
    container.innerHTML = '';

    Object.entries(serviceMapping).forEach(([serviceID, mapping]) => {
        // Find the icon from the hierarchy — check children first, then standalone categories
        let iconTag = '';
        for (const cat of serviceCategories) {
            if (cat.children && cat.children.length > 0) {
                const child = cat.children.find(c => c.ServiceID === serviceID);
                if (child) { iconTag = cat.IconTag || ''; break; }
            } else if (cat.ServiceID === serviceID) {
                iconTag = cat.IconTag || ''; break;
            }
        }

        const div = document.createElement('div');
        div.id = mapping.containerId;
        div.className = 'border rounded p-2 px-3';
        div.innerHTML = `
            <div class="d-flex align-items-center justify-content-between mb-1">
                <div class="d-flex align-items-center gap-2">
                    <i class="text-primary" style="font-size: 1.1rem;"></i>
                    <span class="fw-bold" style="font-size: 0.9rem; color:black;"></span>
                </div>
                <span class="badge fw-bold service-count" style="font-size: 0.8rem; background-color: #e9ecef; color: #495057 !important;">0/0</span>
            </div>
            <div class="progress" style="height: 6px; border-radius: 3px;">
                <div class="progress-bar bg-secondary" role="progressbar" style="width: 0%; border-radius: 3px;"></div>
            </div>`;
        // Set text content safely (not innerHTML) to prevent XSS from DB values
        const icon = div.querySelector('i');
        icon.className = `bi ${iconTag} text-primary`;
        div.querySelector('span.fw-bold').textContent = mapping.displayName;
        container.appendChild(div);
    });
}

// Inline SVG icons used on the service toggle buttons in the table.
// Uses currentColor so they inherit text-white when a button is selected.
// Haircut uses a Bootstrap icon (bi-scissors) and stays null here.
const serviceIcons = {
    medical: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
                <path d="M21.9994 21.9998L21.9998 14.9999L25.9998 15.0001L25.9994 21.9998H32.9998V25.9998H25.9992L25.9988 32.9996L21.9988 32.9994L21.9992 25.9998H14.9998V21.9998H21.9994Z" fill="currentColor"/>
                <path fill-rule="evenodd" clip-rule="evenodd" d="M13.8227 36.991C16.271 39.2023 18.953 41.028 21.9814 42.4676C23.6035 43.2387 25.5274 43.1684 27.0825 42.2813C29.7054 40.7851 31.988 38.9844 34.1951 36.991C38.8735 32.7654 41.6008 26.9498 41.78 20.817L41.9889 13.6659C42.0132 12.8335 41.9901 11 41.9901 11C40.9432 10.8272 39.8847 10.7005 38.8277 10.5739C35.5581 10.1824 32.3025 9.79264 29.4455 8.04646L27.4076 6.80092C25.6603 5.73303 23.4182 5.73302 21.671 6.80092L19.7195 7.99367C16.4534 9.98986 12.4722 10.3682 8.61872 10.7344C7.74583 10.8173 6.8795 10.8996 6.02952 11C6.02952 11 6.00485 12.8445 6.02952 13.6887L6.23778 20.817C6.41696 26.9498 9.14422 32.7654 13.8227 36.991ZM8.01877 12.8019C8.01953 13.1203 8.02239 13.4157 8.02866 13.6303L8.23693 20.7586C8.3997 26.3295 10.877 31.6354 15.1632 35.5067C17.4748 37.5945 19.9958 39.3092 22.8401 40.6613C23.8736 41.1526 25.1068 41.1059 26.0915 40.5441C28.5467 39.1436 30.7109 37.4428 32.8545 35.5067C37.1408 31.6354 39.618 26.3295 39.7808 20.7585L39.9897 13.6075C39.9963 13.3836 39.9992 13.0694 39.9999 12.7328C39.5318 12.6725 39.0564 12.6156 38.5704 12.5574L38.5159 12.5509C37.4407 12.4221 36.3135 12.2863 35.1938 12.0963C32.9498 11.7155 30.6021 11.0973 28.4025 9.75296L26.3646 8.50743C25.2576 7.83086 23.821 7.83086 22.714 8.50743L20.7625 9.70018C18.4439 11.1173 15.8826 11.7888 13.4159 12.1858C11.8861 12.432 10.2384 12.5894 8.69468 12.737C8.46688 12.7587 8.24134 12.7803 8.01877 12.8019Z" fill="currentColor"/>
              </svg>`,
    dental:  `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M23.5592 11.1258C23.7585 10.9692 32.0804 4.49515 37.5808 10.8727C40.6004 14.3739 40.3444 18.0063 39.2239 21.5635L35.2816 32.8565C34.1289 36.783 33.307 37.9951 31.2874 39.701C30.0886 40.7135 28.7366 38.9646 27.3138 37.1239C26.0812 35.5293 24.7954 33.8658 23.5098 33.8697C22.203 33.8737 20.8965 35.5398 19.6465 37.1338C18.2048 38.9724 16.8383 40.715 15.6331 39.701C13.1996 37.6532 12.1324 34.8237 11.0169 30.2829C10.8022 29.4087 10.4755 28.3602 10.1153 27.2039C8.60445 22.3544 6.50278 15.6083 9.58534 11.8657C13.3919 7.24419 18.12 6.50021 23.5088 11.0887L23.5592 11.1258ZM20.9001 11.6004C19.0357 10.3193 17.4509 9.91183 16.1308 10.0157C14.5088 10.1432 12.8241 11.0794 11.1291 13.1373C9.85439 14.6849 9.72465 17.2994 10.4119 20.7151C10.7392 22.3418 11.2167 23.9892 11.6976 25.5539C11.8013 25.8915 11.9067 26.2298 12.0112 26.565C12.3755 27.7341 12.7283 28.8661 12.9592 29.8058C13.9804 33.9629 14.8687 36.1971 16.48 37.7712C16.8126 37.4619 17.2333 36.965 17.7899 36.2597C17.8766 36.1497 17.9666 36.0348 18.0593 35.9164C18.6295 35.1885 19.3048 34.3262 19.9937 33.6369C20.7255 32.9047 21.9352 31.8745 23.5038 31.8697C25.0796 31.8649 26.2861 32.9118 27.003 33.6389C27.6819 34.3276 28.3478 35.1901 28.9098 35.918C29.0017 36.037 29.0908 36.1524 29.1767 36.2629C29.7219 36.9638 30.1349 37.4586 30.4615 37.7681C31.1093 37.1824 31.5294 36.6934 31.8929 36.0853C32.3622 35.3003 32.7993 34.2118 33.3626 32.2931C33.372 32.2609 33.3823 32.229 33.3934 32.1973L37.3253 20.934C37.8394 19.2943 38.1005 17.797 37.9642 16.3899C37.8315 15.0193 37.3116 13.6229 36.0662 12.1789C34.0017 9.78507 31.4653 9.74886 29.0724 10.4904C27.8673 10.8638 26.7857 11.42 25.9936 11.8956C25.6964 12.074 25.4459 12.2375 25.2515 12.3701L29.0925 15.1943C29.5374 15.5215 29.6329 16.1474 29.3057 16.5923C28.9786 17.0373 28.3526 17.1328 27.9077 16.8056L22.4829 12.8168C22.4078 12.769 22.3352 12.7158 22.2657 12.6571L21.1076 11.8056C21.0267 11.7461 20.9574 11.6768 20.9001 11.6004ZM16.1293 38.0449L16.1332 38.043C16.1305 38.0443 16.1292 38.0449 16.1293 38.0449Z" fill="currentColor"/>
              </svg>`,
    optical: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M6.69497 22.1883C8.57391 20.0613 11.4255 17.6246 15.086 15.9661C13.1678 18.0932 12 20.9102 12 24C12 27.0898 13.1678 29.9068 15.086 32.0339C11.4255 30.3754 8.57391 27.9387 6.69497 25.8117C5.76834 24.7628 5.76834 23.2372 6.69497 22.1883ZM5.19605 20.8642C8.60396 17.0063 15.0813 12.0927 23.8218 12.0013C23.8811 12.0004 23.9405 12 24 12L24.0291 12L24.0697 12C32.9356 12 39.5032 16.97 42.9433 20.8642C44.538 22.6695 44.538 25.3305 42.9433 27.1358C39.5032 31.03 32.9356 36 24.0697 36L24.0291 36L24 36C23.9405 36 23.8811 35.9996 23.8218 35.9987C15.0813 35.9073 8.60396 30.9937 5.19606 27.1358C3.60132 25.3305 3.60131 22.6695 5.19605 20.8642ZM24.0284 14C23.9677 14.0002 23.9071 14.0005 23.8466 14.0012C18.3945 14.0831 14 18.5284 14 24C14 29.4716 18.3945 33.9169 23.8466 33.9988C23.9071 33.9995 23.9677 33.9998 24.0284 34C29.5382 33.9847 34 29.5134 34 24C34 18.4866 29.5382 14.0153 24.0284 14ZM36 24C36 27.1409 34.7933 29.9999 32.8182 32.1388C36.5918 30.4794 39.5254 27.984 41.4443 25.8117C42.371 24.7628 42.371 23.2372 41.4443 22.1883C39.5254 20.016 36.5918 17.5206 32.8182 15.8612C34.7933 18.0001 36 20.8591 36 24ZM24.0696 30C27.3833 30 30.0696 27.3137 30.0696 24C30.0696 23.0737 29.8597 22.1965 29.4849 21.4132C29.1229 21.7757 28.6225 22 28.0697 22C26.9651 22 26.0697 21.1046 26.0697 20C26.0697 19.4472 26.294 18.9468 26.6565 18.5848C25.8732 18.2099 24.9959 18 24.0696 18C20.7559 18 18.0696 20.6863 18.0696 24C18.0696 27.3137 20.7559 30 24.0696 30Z" fill="currentColor"/>
              </svg>`,
    haircut: null  // Uses Bootstrap bi-scissors instead
};

// Inline SVG icons used specifically on the printed QR badge.
// Each medical/dental sub-service gets its own icon here.
// Haircut stays null and uses Bootstrap bi-scissors.
const badgeIcons = {
    medicalExam: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <path d="M20 15C20 14.4477 20.4477 14 21 14H29C29.5523 14 30 14.4477 30 15C30 15.5523 29.5523 16 29 16H21C20.4477 16 20 15.5523 20 15Z" fill="currentColor"/>
        <path d="M21 18C20.4477 18 20 18.4477 20 19C20 19.5523 20.4477 20 21 20H29C29.5523 20 30 19.5523 30 19C30 18.4477 29.5523 18 29 18H21Z" fill="currentColor"/>
        <path d="M20 28C20 27.4477 20.4477 27 21 27H29C29.5523 27 30 27.4477 30 28C30 28.5523 29.5523 29 29 29H21C20.4477 29 20 28.5523 20 28Z" fill="currentColor"/>
        <path d="M21 31C20.4477 31 20 31.4477 20 32C20 32.5523 20.4477 33 21 33H29C29.5523 33 30 32.5523 30 32C30 31.4477 29.5523 31 29 31H21Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 27C10 26.4477 10.4477 26 11 26H16C16.5523 26 17 26.4477 17 27V32C17 32.5523 16.5523 33 16 33H11C10.4477 33 10 32.5523 10 32V27ZM12 28V31H15V28H12Z" fill="currentColor"/>
        <path d="M17.7071 15.7071C18.0976 15.3166 18.0976 14.6834 17.7071 14.2929C17.3166 13.9024 16.6834 13.9024 16.2929 14.2929L13 17.5858L11.7071 16.2929C11.3166 15.9024 10.6834 15.9024 10.2929 16.2929C9.90237 16.6834 9.90237 17.3166 10.2929 17.7071L13 20.4142L17.7071 15.7071Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 6C7.79086 6 6 7.79086 6 10V37.9992C6 40.2084 7.79086 41.9992 10 41.9992H30C32.2091 41.9992 34 40.2084 34 37.9992V10C34 7.79086 32.2091 6 30 6H10ZM8 10C8 8.89543 8.89543 8 10 8H30C31.1046 8 32 8.89543 32 10V37.9992C32 39.1038 31.1046 39.9992 30 39.9992H10C8.89543 39.9992 8 39.1038 8 37.9992V10Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M36 16C36 14.3431 37.3431 13 39 13C40.6569 13 42 14.3431 42 16V36.3028L39 40.8028L36 36.3028V16ZM39 15C38.4477 15 38 15.4477 38 16V18H40V16C40 15.4477 39.5523 15 39 15ZM39 37.1972L38 35.6972V20H40V35.6972L39 37.1972Z" fill="currentColor"/>
    </svg>`,
    medicalFollowUp: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M28.874 9C28.874 11.7614 26.6354 14 23.874 14C21.1126 14 18.874 11.7614 18.874 9C18.874 6.23858 21.1126 4 23.874 4C26.6354 4 28.874 6.23858 28.874 9ZM26.874 9C26.874 10.6569 25.5309 12 23.874 12C22.2172 12 20.874 10.6569 20.874 9C20.874 7.34315 22.2172 6 23.874 6C25.5309 6 26.874 7.34315 26.874 9Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M16.8737 32.2071C16.0537 31.595 15.4755 30.6753 15.3117 29.6158C14.642 29.5497 14.011 29.4761 13.4246 29.3957C12.0634 29.2088 10.8605 28.9742 9.95648 28.6808C9.51825 28.5386 9.02967 28.3451 8.61066 28.064C8.28132 27.8431 7.42871 27.1864 7.42871 26C7.42871 24.8136 8.28132 24.1569 8.61066 23.936C9.02967 23.6549 9.51825 23.4614 9.95648 23.3192C10.8098 23.0423 11.9296 22.8177 13.1974 22.6362L13.347 24.6355C12.6527 24.7375 12.0354 24.8496 11.5077 24.9699C11.3807 24.9988 11.2589 25.0283 11.1425 25.0581C10.0488 25.3388 9.42871 25.6595 9.42871 26C9.42871 26.3406 10.0488 26.6612 11.1425 26.9419C11.2589 26.9718 11.3807 27.0012 11.5077 27.0301C12.4726 27.2501 13.7372 27.4425 15.2239 27.5967L15.0016 19.594C14.9341 17.1663 17.028 15.2392 19.4418 15.5074L23.4324 15.9508C23.7259 15.9834 24.0222 15.9834 24.3158 15.9508L28.1762 15.5218C30.6345 15.2487 32.749 17.2497 32.6118 19.7193L32.1708 27.6562C33.921 27.4933 35.3992 27.2794 36.4926 27.0301C36.6196 27.0012 36.7414 26.9718 36.8578 26.9419C37.9515 26.6612 38.5716 26.3406 38.5716 26C38.5716 25.6595 37.9515 25.3388 36.8578 25.0581C36.7414 25.0283 36.6196 24.9988 36.4926 24.9699C36.3362 24.9342 36.1719 24.8993 36 24.8651V26.7002L33 23.7003L36 20.7002V22.8293C36.7775 22.9709 37.4707 23.1332 38.0438 23.3192C38.482 23.4614 38.9706 23.6549 39.3896 23.936C39.719 24.1569 40.5716 24.8136 40.5716 26C40.5716 27.1864 39.719 27.8431 39.3896 28.064C38.9706 28.3451 38.482 28.5386 38.0438 28.6808C37.1398 28.9742 35.9369 29.2088 34.5757 29.3957C33.8013 29.5019 32.9489 29.5963 32.0326 29.6769C31.8863 30.5344 31.469 31.2956 30.8737 31.8723V40.9996C30.8737 42.6565 29.5306 43.9996 27.8737 43.9996H27.7869C26.4185 43.9996 25.2493 43.0794 24.8959 41.8021C24.8634 41.6847 24.8378 41.5643 24.8196 41.4414C24.8112 41.3852 24.8045 41.3285 24.7993 41.2712L24.0473 32.9999H23.7001L22.9482 41.2712C22.943 41.3285 22.9362 41.3852 22.9279 41.4414C22.9097 41.5643 22.8841 41.6847 22.8516 41.8021C22.4982 43.0794 21.3289 43.9996 19.9605 43.9996H19.8737C18.2169 43.9996 16.8737 42.6565 16.8737 40.9996V32.2071ZM18.8737 32.2071C18.8737 31.576 18.5758 30.9819 18.0701 30.6043C17.7886 30.3942 17.5656 30.1143 17.4262 29.7901C19.4223 29.9253 21.6539 30 24.0001 30C26.0892 30 28.0875 29.9408 29.9095 29.8323C29.8054 30.0596 29.6599 30.2636 29.482 30.436C29.0932 30.8127 28.8737 31.331 28.8737 31.8723V40.9996C28.8737 41.5519 28.426 41.9996 27.8737 41.9996H27.7869C27.2697 41.9996 26.8379 41.6052 26.791 41.0902L26.0391 32.8188C25.9455 31.7886 25.0817 30.9999 24.0473 30.9999H23.7001C22.6657 30.9999 21.802 31.7886 21.7083 32.8188L20.9564 41.0902C20.9096 41.6052 20.4777 41.9996 19.9605 41.9996H19.8737C19.3214 41.9996 18.8737 41.5519 18.8737 40.9996V32.2071ZM24.0001 28C21.556 28 19.2525 27.9174 17.2295 27.7715L17.0008 19.5385C16.9671 18.3246 18.014 17.3611 19.2209 17.4952L23.2115 17.9386C23.6519 17.9875 24.0963 17.9875 24.5367 17.9386L28.3971 17.5096C29.6262 17.373 30.6835 18.3735 30.6149 19.6083L30.159 27.8131C28.2883 27.933 26.2012 28 24.0001 28Z" fill="currentColor"/>
    </svg>`,
    dentalHygiene: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <path d="M17.0916 14.3115C17.6439 14.3115 18.0916 14.7592 18.0916 15.3115V18.8447H21.7069C22.2592 18.8447 22.7069 19.2924 22.7069 19.8447C22.7069 20.397 22.2592 20.8447 21.7069 20.8447H18.0916V24.3782C18.0916 24.9305 17.6439 25.3782 17.0916 25.3782C16.5393 25.3782 16.0916 24.9305 16.0916 24.3782V20.8447H12.4761C11.9238 20.8447 11.4761 20.397 11.4761 19.8447C11.4761 19.2924 11.9238 18.8447 12.4761 18.8447H16.0916V15.3115C16.0916 14.7592 16.5393 14.3115 17.0916 14.3115Z" fill="currentColor"/>
        <path fill-rule="evenodd" clip-rule="evenodd" d="M10 36.5402L6.03814 9.76134C5.96575 9.29464 5.99667 8.81811 6.12862 8.36457C6.26098 7.9096 6.49158 7.48944 6.80346 7.1325C7.11529 6.77562 7.50089 6.49045 7.93309 6.29544C8.36516 6.10048 8.83424 5.99991 9.30838 6H24.6935C25.1676 6.00018 25.6365 6.10098 26.0684 6.29611C26.5003 6.49126 26.8857 6.77648 27.1973 7.13332C27.5089 7.49023 27.7393 7.91028 27.8715 8.36509C28.0033 8.81841 28.0342 9.29468 27.9619 9.76114L24 36.5402V38.5C24 39.4154 23.6513 40.3011 23.0184 40.9603C22.3843 41.6209 21.5152 42 20.6 42H13.4C12.4848 42 11.6157 41.6209 10.9816 40.9603C10.3487 40.3011 10 39.4154 10 38.5V36.5402ZM8.75566 8.11845C8.92828 8.04056 9.11679 7.99995 9.3081 8H24.6932C24.8843 8.00012 25.0725 8.04083 25.2449 8.11872C25.4174 8.19664 25.5692 8.30961 25.6907 8.44877C25.8122 8.58787 25.9006 8.74993 25.9511 8.92344C26.0015 9.09691 26.013 9.27863 25.9852 9.45651L22.2061 35H11.7939L8.01608 9.46484L8.01478 9.45651C7.98692 9.27857 7.99852 9.09677 8.049 8.92324C8.0995 8.74967 8.18798 8.58757 8.30954 8.44845C8.43115 8.30927 8.58308 8.19632 8.75566 8.11845ZM21.5757 39.5752C21.843 39.2968 22 38.9107 22 38.5V37.4667H12V38.5C12 38.9107 12.157 39.2968 12.4243 39.5752C12.6903 39.8523 13.0422 40 13.4 40H20.6C20.9578 40 21.3097 39.8523 21.5757 39.5752Z" fill="currentColor"/>
        <path d="M42 7C42 6.44772 41.5523 6 41 6C40.4477 6 40 6.44772 40 7H34V9H40V11H34V13H40V15H34V17H40V18.9919L36.2428 23.3468C36.0862 23.5283 36 23.7602 36 24V41C36 41.5523 36.4477 42 37 42C37.5523 42 38 41.5523 38 41V24.3718L41.7572 20.0169C41.9138 19.8353 42 19.6035 42 19.3636V7Z" fill="currentColor"/>
    </svg>`,
    dentalExtraction: `<svg viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:100%;">
        <path fill-rule="evenodd" clip-rule="evenodd" d="M7.5897 10.1647C11.9517 5.35267 17.3205 4.32394 23.5 9.13368C23.5 9.13368 33.2164 2.43189 39.5776 9.13373C43.6985 13.4753 41.7176 18.0109 39.8111 22.3761C38.7746 24.7492 37.7601 27.072 37.7601 29.2857C37.2785 30.1321 33.1091 30.5819 28.0983 30.7189L15.4476 35.2732L15.0482 33.5426L22.7962 30.7534C20.9309 30.7298 19.0818 30.6704 17.3763 30.5789L14.5953 31.58L14.5653 31.4497C14.4805 31.0822 14.5024 30.7196 14.6081 30.3906C11.5814 30.134 9.43768 29.7555 9.22545 29.2857C9.22545 26.7224 8.36961 24.0539 7.53963 21.466C6.17245 17.2031 4.87545 13.159 7.5897 10.1647ZM22.2716 10.712C22.3269 10.755 22.384 10.7948 22.4426 10.8313L28.9017 15.5439C29.3479 15.8695 29.9734 15.7717 30.299 15.3255C30.6245 14.8793 30.5267 14.2538 30.0805 13.9283L25.2469 10.4017C25.4621 10.2761 25.7283 10.1273 26.0378 9.96696C26.9601 9.48899 28.2305 8.92669 29.6563 8.55625C32.523 7.81143 35.6533 7.90436 38.127 10.5106C39.4171 11.8698 39.8912 13.1465 39.9828 14.3747C40.0796 15.6707 39.7624 17.0765 39.1762 18.6785C38.8857 19.4721 38.5442 20.276 38.1785 21.1165C38.1145 21.2635 38.0496 21.4123 37.984 21.5624L37.9826 21.5655C37.6814 22.2552 37.3679 22.9729 37.083 23.6817C36.5434 25.0242 36.0358 26.4972 35.8425 28.0222C35.8145 28.029 35.7855 28.0358 35.7554 28.0427C35.0398 28.2074 34.0032 28.3531 32.7018 28.4688C30.1167 28.6987 26.7324 28.79 23.3289 28.759C19.9275 28.7281 16.5644 28.5757 14.0266 28.3297C12.8191 28.2126 11.8467 28.0788 11.1618 27.9385C11.0232 26.4294 10.6749 24.9507 10.2799 23.5641C10.0225 22.6603 9.73568 21.7645 9.46222 20.9117L9.44862 20.8694C9.17662 20.0212 8.91904 19.2181 8.69448 18.4343C7.7401 15.103 7.68162 13.0412 9.07151 11.5079C11.0349 9.342 13.0406 8.22681 15.056 8.03172C17.0617 7.83758 19.4534 8.51842 22.2716 10.712ZM36.4772 27.8165C36.4772 27.8165 36.4669 27.8239 36.4397 27.8366C36.4625 27.8225 36.4772 27.8165 36.4772 27.8165ZM10.4054 27.7364L10.4107 27.7388C10.4071 27.7372 10.4054 27.7364 10.4054 27.7364Z" fill="currentColor"/>
        <path d="M33.0953 32.92L16.2999 38.9664L15.9005 37.2358L33.4846 30.9055C33.4928 31.0833 33.477 31.2659 33.4346 31.4497L33.0953 32.92Z" fill="currentColor"/>
        <path d="M17.0131 40.8353L32.5603 35.2383L32.0886 37.2824L19.0397 41.98C18.2259 41.8858 17.4995 41.4638 17.0131 40.8353Z" fill="currentColor"/>
        <path d="M31.5536 39.6007L24.8888 42H28.6134C30.0104 42 31.2225 41.0358 31.5366 39.6746L31.5536 39.6007Z" fill="currentColor"/>
    </svg>`,
    haircut: null  // Uses Bootstrap bi-scissors on the badge too
};

// Tracks which row is being processed and in which mode
let currentRowToUpdate = null;
let currentClientName = "";
let currentClientId = null;
let currentMode = 'checkin'; // 'checkin' or 'reprint'

// -- DOM Element References ----------------------------------

const searchInput    = document.getElementById('registrationSearch');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const noSearchResults = document.getElementById('noSearchResults');
const noSearchTerm   = document.getElementById('noSearchTerm');
const tableBody      = document.querySelector('tbody');
const statRegCount   = document.getElementById('stat-reg-count');
const statCompCount  = document.getElementById('stat-comp-count');
const btnRegistration = document.getElementById('btn-registration');
const btnCheckedIn   = document.getElementById('btn-checked-in');

let currentTab = 'registration';

// -- Tab Switching -------------------------------------------

btnRegistration.addEventListener('click', () => {
    if (currentTab === 'registration') return;
    currentTab = 'registration';
    currentMode = 'checkin';
    btnRegistration.classList.add('active');
    btnCheckedIn.classList.remove('active');
    fetchRegistrationQueue();
});

btnCheckedIn.addEventListener('click', () => {
    if (currentTab === 'checked-in') return;
    currentTab = 'checked-in';
    currentMode = 'reprint';
    btnCheckedIn.classList.add('active');
    btnRegistration.classList.remove('active');
    fetchRegistrationQueue();
});

// -- Utility Functions ---------------------------------------

// Converts "YYYY-MM-DD" to "MM/DD/YYYY". Returns "N/A" for empty input.
function formatDOB(dateString) {
    if (!dateString) return "N/A";
    const [year, month, day] = dateString.split('-');
    return `${month}/${day}/${year}`;
}

// Fetch only service stats and update progress bars (lightweight call after check-in)
function refreshServiceStats() {
    fetch('../api/registration-dashboard.php?RegistrationStatus=Registered', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(response => response.json())
        .then(data => {
            if (data.success && data.services && Array.isArray(data.services)) {
                updateServiceProgressBars(data.services);
            }
        })
        .catch(error => console.error('Error refreshing service stats:', error));
}

//updates the service progress bars based on availability data from API
function updateServiceProgressBars(servicesData) {
    if (!servicesData || !Array.isArray(servicesData)) return;

    // Build a lookup of operational service closed status
    const closedLookup = {};
    servicesData.forEach(s => { closedLookup[s.serviceID] = !!s.isClosed; });

    // Update serviceAvailability per category: available if any child (or self) is not closed
    serviceCategories.forEach(cat => {
        if (cat.children && cat.children.length > 0) {
            serviceAvailability[cat.ServiceID] = cat.children.some(
                child => closedLookup[child.ServiceID] === false
            );
        } else {
            serviceAvailability[cat.ServiceID] = closedLookup[cat.ServiceID] === false;
        }
    });

    // Initialize all service containers first (optional - for services not in API response)
    Object.values(serviceMapping).forEach(mapping => {
        const container = document.getElementById(mapping.containerId);
        if (container) {
            const countSpan = container.querySelector('.service-count');
            const progressBar = container.querySelector('.progress-bar');
            if (countSpan) countSpan.textContent = '0/0';
            if (progressBar) {
                progressBar.style.width = '0%';
            }
        }
    });

    // Update services based on API data
    servicesData.forEach(service => {
        const serviceID = service.serviceID || '';
        const mapping = serviceMapping[serviceID];

        if (!mapping) return; // Skip if we don't have a mapping for this service

        const container = document.getElementById(mapping.containerId);
        if (!container) return;

        const countSpan = container.querySelector('.service-count');
        const progressBar = container.querySelector('.progress-bar');

        const maxCapacity = service.maxCapacity || 0;
        const currentAssigned = service.currentAssigned || 0;

        // Calculate percentage (avoid division by zero)
        const percentage = maxCapacity > 0 ? Math.round((currentAssigned / maxCapacity) * 100) : 0;

        // Update display text
        if (countSpan) {
            countSpan.textContent = `${currentAssigned}/${maxCapacity}`;
        }

        // Update progress bar width and color based on capacity
        if (progressBar) {
            progressBar.style.width = percentage + '%';

            // Remove all color classes
            progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');

            // Add color based on percentage
            if (percentage <= 50) {
                progressBar.classList.add('bg-success');  // Green: under 50%
            } else if (percentage < 80) {
                progressBar.classList.add('bg-warning');  // Yellow: 50-80%
            } else {
                progressBar.classList.add('bg-danger');   // Red: 80%+
            }
        }
    });
}

//updates the stats in the dashboard header. Type can be 'registration' or 'completed'. Value is the number to update.
function updateStats(type, value) {
    if (type === 'registration') {
        if (statRegCount) statRegCount.innerText = value;
    } else if (type === 'completed') {
        if (statCompCount) {
            let current = parseInt(statCompCount.innerText) || 0;
            statCompCount.innerText = current + value;
// Scales a name string down if it's long, to fit on the QR badge.
// Returns an object with the (possibly truncated) text and a font size in rem.
function scaledName(name, maxSize, minSize) {
    const breakpoints = [
        { maxLen: 6,  scale: 1.00 },
        { maxLen: 8,  scale: 0.85 },
        { maxLen: 10, scale: 0.70 },
        { maxLen: 12, scale: 0.58 },
        { maxLen: 14, scale: 0.50 },
    ];

    for (const bp of breakpoints) {
        if (name.length <= bp.maxLen) {
            return { text: name, size: maxSize * bp.scale };
        }
    }

    // Name is too long — truncate it
    return { text: name.slice(0, 14) + '…', size: minSize };
}

// Closes the check-in/reprint modal with a short fade-out animation
function closeModalAnimated() {
    const modal = document.getElementById('checkInModal');
    modal.classList.add('closing');
    setTimeout(() => {
        modal.classList.add('d-none');
        modal.classList.remove('d-flex', 'closing');
    }, 250);
}

// Hides the QR code modal
function closeQrModal() {
    const qrModal = document.getElementById('qrCodeModal');
    qrModal.classList.add('d-none');
    qrModal.classList.remove('d-flex');
}

// -- Service Progress Bars -----------------------------------

// Updates all service progress bars based on the availability data from the API
function updateServiceProgressBars(servicesData) {
    if (!servicesData || !Array.isArray(servicesData)) return;

    // Reset all bars to 0 first
    Object.values(serviceMapping).forEach(({ containerId }) => {
        const container = document.getElementById(containerId);
        if (!container) return;
        const countSpan   = container.querySelector('.service-count');
        const progressBar = container.querySelector('.progress-bar');
        if (countSpan)   countSpan.textContent = '(0/0)';
        if (progressBar) progressBar.style.width = '0%';
    });

    servicesData.forEach(service => {
        const mapping = serviceMapping[service.serviceID];
        if (!mapping) return;

        const container = document.getElementById(mapping.containerId);
        if (!container) return;

        const countSpan   = container.querySelector('.service-count');
        const progressBar = container.querySelector('.progress-bar');

        const max        = service.maxCapacity    || 0;
        const assigned   = service.currentAssigned || 0;
        const percentage = max > 0 ? Math.round((assigned / max) * 100) : 0;

        if (countSpan)   countSpan.textContent = `(${assigned}/${max})`;

        if (progressBar) {
            progressBar.style.width = percentage + '%';
            progressBar.classList.remove('bg-success', 'bg-warning', 'bg-danger');
            if      (percentage <= 50) progressBar.classList.add('bg-success');
            else if (percentage <  80) progressBar.classList.add('bg-warning');
            else                       progressBar.classList.add('bg-danger');
        }
    });
}

// -- Search --------------------------------------------------

// Filters table rows based on what's typed in the search box
function applySearch() {
    const query = searchInput.value.trim().toLowerCase();
    let visibleCount = 0;

    tableBody.querySelectorAll('tr[data-client-id]').forEach(row => {
        const nameEl = row.querySelector('.fw-bold.text-dark');
        if (!nameEl) return;
        const matches = nameEl.innerText.toLowerCase().includes(query);
        row.style.display = matches ? '' : 'none';
        if (matches) visibleCount++;
    });

    const hasQuery = query.length > 0;
    noSearchResults.classList.toggle('d-none', !hasQuery || visibleCount > 0);
    if (hasQuery && visibleCount === 0) noSearchTerm.textContent = searchInput.value.trim();
    clearSearchBtn.style.display = hasQuery ? '' : 'none';
}

searchInput.addEventListener('input', applySearch);

clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    applySearch();
    searchInput.focus();
});

// -- Table Rendering -----------------------------------------

// Builds the HTML for a single service toggle button
function buildServiceButton(serviceType, state, iconClass, serviceKey) {
    const isAvailable = serviceAvailability[serviceKey];
    state = parseInt(state);

    // If the patient has this service but it's not available today, force the "unavailable" state
    if (state === 1 && !isAvailable) state = -1;

    const colorClass = state === 1 ? 'btn-success'
                     : state === 0 ? (isAvailable ? 'btn-grey' : 'btn-grey locked-btn')
                     : 'btn-danger';

    const iconColor   = state === 1 ? 'text-white' : '';
    const disabledAttr = state === -1 ? 'disabled' : '';

    // Use inline SVG if available; otherwise fall back to a Bootstrap icon class
    const iconHTML = serviceIcons[serviceKey]
        ? `<span class="${iconColor}" style="width:20px;height:20px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">${serviceIcons[serviceKey]}</span>`
        : `<i class="bi ${iconClass} ${iconColor}"></i>`;

    return `
        <button class="btn ${colorClass} btn-sm rounded-2 service-btn"
                data-state="${state}" ${disabledAttr} title="${serviceType}"
                style="width:32px;height:32px;padding:0;display:flex;align-items:center;justify-content:center;">
            ${iconHTML}
        </button>
    `;
}

// Builds a full name string from patient data (includes middle initial if present)
function buildFullName(patient) {
    if (patient.MiddleInitial) {
        return `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
    }
    return `${patient.FirstName} ${patient.LastName}`;
}

// Shared avatar + name cell used in both table views
function buildNameCell(fullName) {
    return `
        <td class="ps-4">
            <div class="d-flex align-items-center gap-3">
                <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width:40px;height:40px;">
                    <i class="bi bi-person-circle" style="font-size:1.5rem"></i>
                </div>
                <span class="fw-bold text-dark">${fullName}</span>
            </div>
        </td>
    `;
}

// Sorts an array of patient objects alphabetically by last name, then first name
function sortPatients(patients) {
    return patients.sort((a, b) => {
        const last = a.LastName.localeCompare(b.LastName);
        return last !== 0 ? last : a.FirstName.localeCompare(b.FirstName);
    });
}

// Populates the Registration tab (patients not yet checked in)
function populateRegistrationTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
        return;
    }

    sortPatients(patientsData).forEach(patient => {
        const fullName  = buildFullName(patient);
        const serviceSet = new Set(patient.services || []);

        const hasMedical = serviceSet.has('medical') ? 1 : 0;
        const hasDental  = serviceSet.has('dental')  ? 1 : 0;
        const hasOptical = serviceSet.has('optical') ? 1 : 0;
        const hasHair    = serviceSet.has('haircut') ? 1 : 0;

        tableBody.insertAdjacentHTML('beforeend', `
            <tr class="align-middle" data-client-id="${patient.ClientID}" data-translator="${patient.TranslatorNeeded || 0}">
                ${buildNameCell(fullName)}
                <td class="fw-medium text-secondary">${formatDOB(patient.DOB)}</td>
                <td>
                    <div class="d-flex justify-content-between align-items-center pe-3">
                        <div class="d-flex gap-3">
                            ${buildServiceButton('Medical', hasMedical, 'bi-heart-pulse', 'medical')}
                            ${buildServiceButton('Dental',  hasDental,  'bi-shield-shaded', 'dental')}
                            ${buildServiceButton('Optical', hasOptical, 'bi-eye', 'optical')}
                            ${buildServiceButton('Haircut', hasHair,    'bi-scissors', 'haircut')}
                        </div>
                        <button class="btn bg-primary text-white btn-sm check-in-btn">Check In</button>
                    </div>
                </td>
            </tr>
        `);
    });

    if (searchInput.value.trim()) applySearch();
}

// Populates the Checked In tab (services pulled from tblVisitServices)
function populateCheckedInTable(patientsData) {
    tableBody.innerHTML = '';

    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No checked-in patients found.</td></tr>';
        return;
    }

    sortPatients(patientsData).forEach(patient => {
        const fullName   = buildFullName(patient);
        const serviceSet = new Set(patient.services || []);

        // Show medical/dental buttons as selected if either sub-type is present
        const hasMedical = (serviceSet.has('medicalExam') || serviceSet.has('medicalFollowUp')) ? 1 : 0;
        const hasDental  = (serviceSet.has('dentalHygiene') || serviceSet.has('dentalExtraction')) ? 1 : 0;
        const hasOptical = serviceSet.has('optical') ? 1 : 0;
        const hasHaircut = (serviceSet.has('haircut') || serviceSet.has('hair')) ? 1 : 0;

        // Store the exact sub-service for pre-populating the modal on reprint
        const medicalSub = serviceSet.has('medicalExam') ? 'MedicalExam'
                         : serviceSet.has('medicalFollowUp') ? 'MedicalFollowUp' : '';
        const dentalSub  = serviceSet.has('dentalHygiene') ? 'dentalHygiene'
                         : serviceSet.has('dentalExtraction') ? 'dentalExtraction' : '';

        tableBody.insertAdjacentHTML('beforeend', `
            <tr class="align-middle"
                data-client-id="${patient.ClientID}"
                data-translator="${patient.TranslatorNeeded || 0}"
                data-medical-sub="${medicalSub}"
                data-dental-sub="${dentalSub}">
                ${buildNameCell(fullName)}
                <td class="fw-medium text-secondary">${formatDOB(patient.DOB)}</td>
                <td>
                    <div class="d-flex justify-content-between align-items-center pe-3">
                        <div class="d-flex gap-3">
                            ${buildServiceButton('Medical', hasMedical, 'bi-heart-pulse', 'medical')}
                            ${buildServiceButton('Dental',  hasDental,  'bi-shield-shaded', 'dental')}
                            ${buildServiceButton('Optical', hasOptical, 'bi-eye', 'optical')}
                            ${buildServiceButton('Haircut', hasHaircut, 'bi-scissors', 'haircut')}
                        </div>
                        <button class="btn btn-primary btn-sm reprint-btn">
                            <i class="bi bi-printer me-1"></i>Reprint
                        </button>
                    </div>
                </td>
            </tr>
        `);
    });

    if (searchInput.value.trim()) applySearch();
}

// -- Data Fetching -------------------------------------------

// Fetches queue data from the API and populates the appropriate table
function fetchRegistrationQueue() {
    tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">Loading...</td></tr>';

    const status = currentTab === 'checked-in' ? 'CheckedIn' : 'Registered';

    fetch(`../api/registration-dashboard.php?RegistrationStatus=${status}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
    })
        .then(r => r.json())
        .then(data => {
            const clients = data.success ? (data.data || []).filter(c => c.ClientID) : [];

            if (currentTab === 'checked-in') {
                populateCheckedInTable(clients);
                if (statCompCount) statCompCount.innerText = clients.length;
            } else {
                populateRegistrationTable(clients);
                if (statRegCount) statRegCount.innerText = clients.length;

                // Also fetch the checked-in count to keep that stat up to date
                fetch('../api/registration-dashboard.php?RegistrationStatus=CheckedIn', {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' }
                })
                    .then(r => r.json())
                    .then(checkedInData => {
                        if (statCompCount) {
                            const checkedInClients = (checkedInData.data || []).filter(c => c.ClientID);
                            statCompCount.innerText = checkedInClients.length;
                        }
                    });
            }

            if (!data.success) {
                tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
            }

            if (data.services && Array.isArray(data.services)) {
                updateServiceProgressBars(data.services);
            }
        })
        .catch(error => {
            console.error('Error fetching queue:', error);
            tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-danger">Connection error. Please refresh.</td></tr>';
        });
}

// -- Table Click Handler -------------------------------------

    // If no patients are in the queue, displayed message instead of empty table
    if (patientsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="3" class="text-center p-3 text-muted">No patients currently in queue.</td></tr>';
        return;
    }

    // Sort patients by Last Name, then First Name (both case-insensitive)
    patientsData.sort((a, b) => {

        //Compare Last Names (Case-insensitive)
        const lastNameComparison = a.LastName.localeCompare(b.LastName);

        // If Last Names are different, use that order
        if (lastNameComparison !== 0) {
            return lastNameComparison;
        }

        // If Last Names are identical (e.g., two "Smiths"), sort by First Name
        return a.FirstName.localeCompare(b.FirstName);
    });

    //properly format each patient's name and DOB, then create a table row with their info and requested services
    patientsData.forEach(patient => {
        let fullName = `${patient.FirstName} ${patient.LastName}`;
        if (patient.MiddleInitial) {
            fullName = `${patient.FirstName} ${patient.MiddleInitial}. ${patient.LastName}`;
        }
        const formattedDOB = formatDOB(patient.DOB);

        // Build service buttons dynamically from serviceCategories
        const serviceSet = new Set(patient.services || []);
        let serviceButtonsHTML = '';
        serviceCategories.forEach(cat => {
            const state = serviceSet.has(cat.ServiceID) ? 1 : 0;
            serviceButtonsHTML += buildServiceButton(cat.ServiceName, state, cat.IconTag || 'bi-circle', cat.ServiceID);
        });

        const rowHTML = `
            <tr class="align-middle" data-client-id="${patient.ClientID}" data-translator="${patient.TranslatorNeeded || 0}">
                <td class="ps-4">
                    <div class="d-flex align-items-center gap-3">
                        <div class="rounded-circle border d-flex align-items-center justify-content-center bg-light" style="width: 40px; height: 40px;">
                            <i class="bi bi-person-circle" style="font-size: 1.5rem"></i>
                        </div>
                        <span class="fw-bold text-dark">${fullName}</span>
                    </div>
                </td>
                <td class="fw-medium text-secondary">${formattedDOB}</td>
                <td>
                    <div class="d-flex justify-content-between align-items-center pe-3">
                        <div class="d-flex gap-3">
                            ${serviceButtonsHTML}
                        </div>
                        <button class="btn bg-primary text-white btn-sm check-in-btn">Check In</button>
                    </div>
                </td>
            </tr>
        `;
        tableBody.insertAdjacentHTML('beforeend', rowHTML);
    });

    // Re-apply any active search filter after table repopulates
    if (searchInput.value.trim()) {
        applySearch();
    }
}

//================================================================================
// 5. TABLE EVENT LISTENERS (Service Toggles & Check-In)

// Using event delegation to handle clicks on service buttons and check-in buttons within the table body
tableBody.addEventListener('click', function (event) {

    // Service toggle buttons (both tabs)
    const serviceBtn = event.target.closest('.service-btn');
    if (serviceBtn) {
        if (serviceBtn.hasAttribute('disabled') || serviceBtn.classList.contains('locked-btn')) return;

        const state = parseInt(serviceBtn.getAttribute('data-state'));
        const icon  = serviceBtn.querySelector('i');

        if (state === 1) {
            serviceBtn.setAttribute('data-state', '0');
            serviceBtn.classList.replace('btn-success', 'btn-grey');
            icon?.classList.remove('text-white');
        } else if (state === 0) {
            serviceBtn.setAttribute('data-state', '1');
            serviceBtn.classList.replace('btn-grey', 'btn-success');
            icon?.classList.add('text-white');
        }
        return;
    }

    // Check In button (Registration tab)
    const checkInBtn = event.target.closest('.check-in-btn');
    if (checkInBtn) {
        currentMode = 'checkin';
        openServiceModal(checkInBtn.closest('tr'));
        return;
    }

        // --- Build sub-service sections dynamically ---
        const subSvcContainer = document.getElementById('modalSubServiceSections');
        subSvcContainer.innerHTML = '';

        // Help text shown below the label in the check-in modal for categories with sub-services
        const categoryDescriptions = {
            'medical': 'Choose Exam if this is the patient\'s first time, Follow Up if they\'ve been here before.',
            'dental':  'Extraction is surgical pulling of teeth, Hygiene is everything else.'
        };

        serviceCategories.forEach(cat => {
            const btn = currentRowToUpdate.querySelector(`[title="${cat.ServiceName}"]`);
            if (!btn) return;
            const state = parseInt(btn.getAttribute('data-state'));
            const isAvailable = serviceAvailability[cat.ServiceID];

            if (state === 1 && isAvailable && cat.children && cat.children.length > 0) {
                // Build radio group for sub-services with short labels (strip parent name prefix)
                const radioName = `${cat.ServiceID}Choice`;
                let radiosHTML = cat.children.map(child => {
                    let shortLabel = child.ServiceName;
                    if (shortLabel.toLowerCase().startsWith(cat.ServiceName.toLowerCase())) {
                        shortLabel = shortLabel.substring(cat.ServiceName.length).replace(/^[\s\-–—]+/, '');
                    }
                    return `
                    <div class="form-check">
                        <input class="form-check-input" type="radio" name="${radioName}" 
                            id="${child.ServiceID}" value="${child.ServiceID}">
                        <label class="form-check-label text-dark" for="${child.ServiceID}">${shortLabel || child.ServiceName}</label>
                    </div>`;
                }).join('');

                const descHTML = categoryDescriptions[cat.ServiceID]
                    ? `<p class="text-muted small mb-2">${categoryDescriptions[cat.ServiceID]}</p>`
                    : '';

                subSvcContainer.innerHTML += `
                    <div class="mb-4 p-3 border rounded bg-light sub-service-section" data-category="${cat.ServiceID}">
                        <label class="fw-bold mb-2 text-primary">Select ${cat.ServiceName} Service:</label>
                        ${descHTML}
                        <div class="d-flex gap-4">${radiosHTML}</div>
                    </div>`;
            }
        });

        // Auto-toggle translator checkbox if client was flagged as needing one (e.g. registered in Spanish)
        const translatorNeeded = currentRowToUpdate.getAttribute('data-translator');
        document.getElementById('translatorCheck').checked = (translatorNeeded === '1');

        document.getElementById('modalPatientName').innerText = currentClientName;

        const modal = document.getElementById('checkInModal');
        modal.classList.remove('d-none');
        modal.classList.add('d-flex');
    }
});

// -- Modal ---------------------------------------------------

// Opens the check-in / reprint modal and pre-populates it from the clicked row
function openServiceModal(row) {
    currentRowToUpdate = row;
    currentClientName  = row.querySelector('.fw-bold.text-dark').innerText;
    currentClientId    = row.getAttribute('data-client-id');

    const isReprint = currentMode === 'reprint';

    // Update header and button label for the current mode
    document.querySelector('#checkInModal .card-header h5').textContent =
        isReprint ? 'Edit & Reprint Badge' : 'Finalize Check-In';
    document.getElementById('finalizeCheckInBtn').innerHTML =
        isReprint ? '<i class="bi bi-printer me-1"></i>Save & Reprint' : 'Finalize Check-In';

    // Translator toggle
    document.getElementById('translatorCheck').checked =
        row.getAttribute('data-translator') === '1';

    // Medical section
    document.getElementById('medicalExam').checked    = false;
    document.getElementById('medicalFollowUp').checked = false;
    const medicalSection = document.getElementById('modalMedicalSection');
    const medicalState   = parseInt(row.querySelector('[title="Medical"]').getAttribute('data-state'));

    if (medicalState === 1 && serviceAvailability.medical) {
        medicalSection.classList.remove('d-none');
        if (isReprint) {
            const sub = row.getAttribute('data-medical-sub');
            if (sub === 'MedicalExam')    document.getElementById('medicalExam').checked    = true;
            if (sub === 'MedicalFollowUp') document.getElementById('medicalFollowUp').checked = true;
        }
    } else {
        medicalSection.classList.add('d-none');
    }

    // Dental section
    document.getElementById('dentalHygiene').checked    = false;
    document.getElementById('dentalExtraction').checked = false;
    const dentalSection = document.getElementById('modalDentalSection');
    const dentalState   = parseInt(row.querySelector('[title="Dental"]').getAttribute('data-state'));

    if (dentalState === 1 && serviceAvailability.dental) {
        dentalSection.classList.remove('d-none');
        if (isReprint) {
            const sub = row.getAttribute('data-dental-sub');
            if (sub === 'dentalHygiene')    document.getElementById('dentalHygiene').checked    = true;
            if (sub === 'dentalExtraction') document.getElementById('dentalExtraction').checked = true;
        }
    } else {
        dentalSection.classList.add('d-none');
    }

    document.getElementById('modalPatientName').innerText = currentClientName;
    const modal = document.getElementById('checkInModal');
    modal.classList.remove('d-none');
    modal.classList.add('d-flex');
}

document.getElementById('cancelCheckInBtn').addEventListener('click', closeModalAnimated);

document.getElementById('finalizeCheckInBtn').addEventListener('click', function () {
    const btn = this;
    const isInterpreterNeeded = document.getElementById('translatorCheck').checked;

    // Build services array dynamically from category buttons and sub-service selections
    const services = [];
    const categoryStates = {}; // track which categories are selected for QR card

    for (const cat of serviceCategories) {
        const catBtn = currentRowToUpdate.querySelector(`[title="${cat.ServiceName}"]`);
        if (!catBtn) continue;
        const state = parseInt(catBtn.getAttribute('data-state'));
        categoryStates[cat.ServiceID] = (state === 1);

        if (state !== 1) continue;

        if (cat.children && cat.children.length > 0) {
            // Category has sub-services — require radio selection
            const radioName = `${cat.ServiceID}Choice`;
            const selected = document.querySelector(`input[name="${radioName}"]:checked`);
            if (!selected) {
                Swal.fire({
                    icon: 'warning',
                    title: 'Selection Required',
                    text: `Please select a ${cat.ServiceName} sub-service to proceed.`,
                    confirmButtonColor: '#174593'
                });
                return;
            }
            services.push(selected.value);
        } else {
            // Standalone category (no children) — use category ID directly
            services.push(cat.ServiceID);
        }
    }

    // Loading state
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = 'Processing...';

    const endpoint = currentMode === 'reprint' ? '../api/Reprint.php' : '../api/CheckIn.php';

    fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientID: currentClientId, services, needsInterpreter: isInterpreterNeeded })
    })
        .then(r => r.json())
        .then(data => {
            if (data.success) {

                // Close check-in modal
                closeModalAnimated();

                // Remove patient from queue table
                if (currentRowToUpdate) {
                    currentRowToUpdate.remove();
                }

                // Update Stats
                // Decrement registration count
                let currentReg = parseInt(statRegCount.innerText) || 0;
                statRegCount.innerText = Math.max(0, currentReg - 1);

                // Update processed count from API (source of truth is the DB)
                if (statCompCount && data.clientsProcessed !== undefined) {
                    statCompCount.innerText = data.clientsProcessed;
                } else if (statCompCount) {
                    // Fallback: increment locally if API didn't return updated count
                    statCompCount.innerText = (parseInt(statCompCount.innerText) || 0) + 1;
                }

                // Refresh service progress bars with latest counts
                refreshServiceStats();

                // Show QR modal
                const qrModal = document.getElementById('qrCodeModal');
                qrModal.classList.remove('d-none');
                qrModal.classList.add('d-flex');

                // Split name and convert First Name to ALL CAPS
                const nameParts = currentClientName.split(' ');
                const firstName = nameParts[0].toUpperCase();
                const lastName = nameParts.slice(1).join(' ');

                // Get the name elements
                const firstNameEl = document.getElementById('qrCardFirstName');
                const lastNameEl = document.getElementById('qrCardLastName');

                // Scale font size down based on character length so name always fits on one line.
                // Truncate with ellipsis only as a last resort if over 16 chars.
                function scaledName(name, maxSize, minSize) {
                    const len = name.length;
                    if (len <= 6)  return { text: name, size: maxSize };
                    if (len <= 8)  return { text: name, size: maxSize * 0.85 };
                    if (len <= 10) return { text: name, size: maxSize * 0.70 };
                    if (len <= 12) return { text: name, size: maxSize * 0.58 };
                    if (len <= 14) return { text: name, size: maxSize * 0.50 };
                    // Beyond 14 chars: truncate and use minimum size
                    return { text: name.slice(0, 14) + '…', size: minSize };
                }

                const first = scaledName(firstName, 2.5, 1.1);
                const last  = scaledName(lastName,  1.5, 0.8);

                firstNameEl.innerText = first.text;
                firstNameEl.style.fontSize = first.size + 'rem';

                lastNameEl.innerText = last.text;
                lastNameEl.style.fontSize = last.size + 'rem';

                // Generate QR Code (QRious library)
                new QRious({
                    element: document.getElementById('qr'),
                    value: currentClientId,
                    size: 200,
                });

                // Build QR card icons dynamically from serviceCategories
                const qrIconsContainer = document.getElementById('qrCardIcons');
                qrIconsContainer.innerHTML = '';
                serviceCategories.forEach(cat => {
                    const iconEl = document.createElement('i');
                    iconEl.className = `bi ${cat.IconTag} qr-icon-border`;
                    iconEl.style.fontSize = '2.5rem';
                    iconEl.style.color = 'black';
                    iconEl.style.visibility = categoryStates[cat.ServiceID] ? 'visible' : 'hidden';
                    iconEl.style.display = 'inline-flex';
                    qrIconsContainer.appendChild(iconEl);
                });
                document.getElementById('qrCardTranslator').style.display = 'none';

                // Translator badge: show the icon pinned to top-right of the name area
                if (isInterpreterNeeded) {
                    document.getElementById('qrCardTranslator').style.display = 'block';
                }

            } else {
                // Check-in failed logic
                closeQrModal();
                Swal.fire({
                    icon: 'error',
                    title: currentMode === 'reprint' ? 'Reprint Failed' : 'Check-In Failed',
                    text: data.message || 'Unable to process this patient.',
                    confirmButtonColor: '#174593'
                });
                return;
            }

            closeModalAnimated();

            if (currentMode === 'checkin') {
                // Remove the row — the patient has moved to the Checked In tab
                currentRowToUpdate?.remove();
                if (statRegCount)  statRegCount.innerText  = Math.max(0, (parseInt(statRegCount.innerText)  || 0) - 1);
                if (statCompCount) statCompCount.innerText = data.clientsProcessed !== undefined
                    ? data.clientsProcessed
                    : (parseInt(statCompCount.innerText) || 0) + 1;
            } else {
                // Reprint: keep the row but update its data attributes for the next reprint
                currentRowToUpdate?.setAttribute('data-medical-sub', selectedMedical?.value || '');
                currentRowToUpdate?.setAttribute('data-dental-sub',  selectedDental?.value  || '');
                currentRowToUpdate?.setAttribute('data-translator',  isInterpreterNeeded ? '1' : '0');
            }

            // Show the QR badge modal
            const qrModal = document.getElementById('qrCodeModal');
            qrModal.classList.remove('d-none');
            qrModal.classList.add('d-flex');

            // Scale the patient name to fit on the badge
            const nameParts = currentClientName.split(' ');
            const first = scaledName(nameParts[0].toUpperCase(), 2.5, 1.1);
            const last  = scaledName(nameParts.slice(1).join(' '), 1.5, 0.8);

            const firstNameEl = document.getElementById('qrCardFirstName');
            const lastNameEl  = document.getElementById('qrCardLastName');
            firstNameEl.innerText    = first.text;
            firstNameEl.style.fontSize = first.size + 'rem';
            lastNameEl.innerText     = last.text;
            lastNameEl.style.fontSize  = last.size + 'rem';

            new QRious({ element: document.getElementById('qr'), value: currentClientId, size: 200 });

            // Reset all badge icons to hidden
            ['qrCardMedicalIcon', 'qrCardDentalIcon', 'qrCardOpticalIcon', 'qrCardHaircutIcon'].forEach(id => {
                const el = document.getElementById(id);
                el.style.visibility = 'hidden';
                el.style.display    = 'inline-flex';
            });
            document.getElementById('qrCardTranslator').style.display = 'none';

            // Helper: inject an SVG into a badge slot, or just make it visible if no SVG exists
            function showBadgeIcon(slotId, iconKey) {
                const el  = document.getElementById(slotId);
                const key = iconKey.charAt(0).toLowerCase() + iconKey.slice(1);
                const svg = badgeIcons[key];
                if (svg) el.innerHTML = svg;
                el.style.visibility = 'visible';
            }

            const medSectionHidden    = document.getElementById('modalMedicalSection').classList.contains('d-none');
            const dentalSectionHidden = document.getElementById('modalDentalSection').classList.contains('d-none');
            const medSubKey    = (!medSectionHidden    && selectedMedical) ? selectedMedical.value : null;
            const dentalSubKey = (!dentalSectionHidden && selectedDental)  ? selectedDental.value  : null;

            if (hasMedical && medSubKey)    showBadgeIcon('qrCardMedicalIcon', medSubKey);
            else if (hasMedical)            document.getElementById('qrCardMedicalIcon').style.visibility = 'visible';

            if (hasDental && dentalSubKey)  showBadgeIcon('qrCardDentalIcon', dentalSubKey);
            else if (hasDental)             document.getElementById('qrCardDentalIcon').style.visibility = 'visible';
            if (hasOptical) document.getElementById('qrCardOpticalIcon').style.visibility = 'visible';
            if (hasHaircut) document.getElementById('qrCardHaircutIcon').style.visibility = 'visible';
            if (isInterpreterNeeded) document.getElementById('qrCardTranslator').style.display = 'block';
        })
        .catch(error => {
            closeQrModal();
            console.error('API Error:', error);
            Swal.fire({ icon: 'error', title: 'Connection Error', text: 'Unable to connect to the server. Please try again.', confirmButtonColor: '#174593' });
        })
        .finally(() => {
            btn.disabled  = false;
            btn.innerHTML = originalHTML;
        });
});

// -- QR Modal Actions ----------------------------------------

document.getElementById('printQrBtn').addEventListener('click', function () {
    const style = document.createElement('style');
    style.textContent = `
        @media print {
            @page { size: 2.3125in 4in; margin: 0; }
            html, body { height: 4in !important; overflow: hidden !important; margin: 0 !important; padding: 0 !important; }
            body * { visibility: hidden; }
            #qrCodeModal, #qrCodeModal * { visibility: visible; }
            #qrCodeModal {
                position: absolute; left: 0; top: 0;
                width: 2.3125in !important; height: 4in !important;
                background: white !important; padding: 0.1in !important;
                display: flex !important; align-items: flex-start !important; margin: 0 !important;
            }
            #qrCodeModal .card { width: 100% !important; height: 100% !important; max-width: none !important; border: none !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
            #printQrBtn, #closeQrBtn { display: none !important; }
            #qrCodeModal .qr-icon-border {
                flex-shrink: 0 !important; font-size: 2rem !important;
                width: 46px !important; height: 46px !important;
                border: 2px solid black !important; border-radius: 8px !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
            }
            #qrCodeModal .gap-3 { gap: 0.25rem !important; }
            #qrCodeModal canvas { max-width: 1.8in !important; height: auto !important; }
        }
    `;
    document.head.appendChild(style);
    window.print();
    setTimeout(() => document.head.removeChild(style), 100);
});

document.getElementById('closeQrBtn').addEventListener('click', () => {
    closeQrModal();
    // On check-in close, refresh the queue so the moved patient no longer shows
    if (currentMode === 'checkin') fetchRegistrationQueue();
});

//================================================================================
// 8. INITIALIZATION
(async () => {
    await loadServiceHierarchyForDashboard();
    buildServiceProgressBars();
    fetchRegistrationQueue();
})();
