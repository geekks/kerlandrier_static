loadEvents()
const DateTime = luxon.DateTime;

/**
 * Charge les événements sur la page. Ceci est fait uniquement au chargement initial de la page
 * Ensuite, on utilise le résultat en local
 * @param {string} [query] - url de la requête pour récupérer les événements
 * @param {string[]} [areaFilters] - filtres pour afficher/masquer des événements
 * @returns {Promise<void>}
 */
async function loadEvents(query = defaultQuery) {
    const response = await fetch(query);
    const evnts = await response.json();
    
    const grist = await fetch('https://grist.hentou.org/api/docs/fRo9SxKZ7NnJnN4vkNrg1s/tables/Kerlandrier/records');
    const gristData = grist.status === 200 
        ? await grist.json() 
        : null;
    const gristEvnts = (gristData && gristData.records)
        ? gristData.records.map((data) => data.fields)
        : {};
    const upcomingGristEvnts = (gristEvnts.length > 0)
        ? gristEvnts.filter((e) => new Date() <= new Date(e.end_date_time * 1000))
        : [];

        // Merge OA events with Grist events
        const allEvnts = [...evnts.events, ...upcomingGristEvnts];
        
    const sortedAllEvnts = allEvnts.sort((a, b) => {
        const dateA = new Date(a.nextTiming?.begin ?? a.start_date_time * 1000);
        const dateB = new Date(b.nextTiming?.begin ?? b.start_date_time * 1000);
        return dateA - dateB;
    });

    // Store in local storage
    localStorage.setItem("events", JSON.stringify(sortedAllEvnts));
    console.log(sortedAllEvnts)
    buildCalendar(sortedAllEvnts);
}

// ---------------------------------------------------------------------------
// distance helpers – calculate how far an event is from the reference point
// ---------------------------------------------------------------------------

/**
 * Haversine formula – distance between two lat/lon points in kilometres
 */
function distanceKm(lat1, lon1, lat2 = 0, lon2 = 0) {
    const R = 6371; // earth radius in km
    const toRad = x => x * Math.PI / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Returns "TRES PROCHE", "PROCHE" or "MOINS PROCHE" for an event.  If the
 * event lacks coordinates the result is null.
 */
function getDistanceCategory(event) {
    // if (!event.location ||
    //     typeof event.location.latitude !== 'number' ||
    //     typeof event.location.longitude !== 'number' ||
    //     typeof event.location_latitude !== 'number' ||
    //     typeof event.location.longitude !== 'number') {
    //     return null;
    // }
    const dist = distanceKm(
        REFERENCE_COORDS.latitude, REFERENCE_COORDS.longitude,
        event.location.latitude ?? event.location_latitude, event.location.longitude ?? event.location_longitude
    );
    if (dist < DISTANCE_THRESHOLDS.TRES_PROCHE) return 'TRES PROCHE';
    if (dist < DISTANCE_THRESHOLDS.PROCHE) return 'PROCHE';
    return 'MOINS PROCHE';
}

// ── Add to Calendar ──────────────────────────────────────────────────────────

/** Escape a value for use inside an HTML double-quoted attribute. */
function escAttr(s) {
    return (s ?? '').replace(/[&"<>\n\r]/g, ' ');
}

function addToCalendarClick(btn) {
    const title = btn.dataset.title;
    const start = new Date(btn.dataset.start);
    const end   = new Date(btn.dataset.end);
    const loc   = btn.dataset.location;
    const desc  = btn.dataset.description.substring(0, 60);

    const fmt = d => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

    // 1. Clean description for ICS format
    const cleanDesc = desc
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\r?\n/g, '\\n')
        .trim();

    // 2. Build the ICS structure
    const icsContent = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Kerlandrier//FR',
        'CALSCALE:GREGORIAN',
        'METHOD:PUBLISH',
        'BEGIN:VEVENT',
        `UID:${Date.now()}@kerlandrier.fr`,
        `DTSTART:${fmt(start)}`,
        `DTEND:${fmt(end)}`,
        `SUMMARY:${title}`,
        `LOCATION:${loc}`,
        `DESCRIPTION:${cleanDesc}`,
        'END:VEVENT',
        'END:VCALENDAR'
    ].join('\r\n');

    // 3. Create a standard filename
    const fileName = title.slice(0, 40).replace(/[^\w ]/g, '').replace(/\s+/g, '_') + '.ics';

    // 4. Create the File object from the ICS string
    const file = new File([icsContent], fileName, { type: 'text/calendar' });

    // 5. Try Native Sharing API
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
        navigator.share({
            files: [file],
            title: title,
            text: desc
        })
        .catch(err => {
            // Re-throw if it wasn't a user cancellation
            if (err.name !== 'AbortError') console.error('Share failed:', err);
        });
    } else {
        // 6. FALLBACK: Device doesn't support file sharing (e.g., Desktop)
        const isApple = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
                        (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);

        if (isApple) {
            // Fallback for Apple Desktop (Safari Mac doesn't always support file sharing)
            const base64Ics = btoa(unescape(encodeURIComponent(icsContent)));
            const dataUrl = `data:text/calendar;charset=utf-8;base64,${base64Ics}`;
            
            const a = Object.assign(document.createElement('a'), {
                href: dataUrl,
                download: fileName,
                style: 'display:none'
            });
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            // Fallback for Android/Desktop Chrome/Firefox: Google Calendar Link
            window.open(
                'https://calendar.google.com/calendar/render?action=TEMPLATE' +
                `&text=${encodeURIComponent(title)}` +
                `&dates=${fmt(start)}/${fmt(end)}` +
                `&details=${encodeURIComponent(desc)}` +
                `&location=${encodeURIComponent(loc)}`,
                '_blank'
            );
        }
    }
}


function buildCalendar(evnts = null, areaFilters = [], dateFilter = "") {
    // Init date filters as Date
    const startDate = dateFilter ? new Date(dateFilter.split(",")[0]) : null;
    const endDate = dateFilter ? new Date(dateFilter.split(",")[1]) : null;

    // Get events from localStorage
    if (evnts === null) evnts = JSON.parse(localStorage.getItem("events"));

    // Filter events: area & date
    const eventsRaw = evnts; // Array of { title, onlineAccessLink... }
    const eventsFiltered = eventsRaw // Array of { title, onlineAccessLink... } but filtered based on location.description and selectedMonth
        .filter((d) => d.nextTiming || d.origin_agenda === "GRIST") // Make sure no shitty events gets displayed + shitty identification of Grist events
        .filter((d) => {
            // distance-category filter (TRES PROCHE / PROCHE / MOINS PROCHE)
            if (areaFilters.length === 0) return true;
            const cat = getDistanceCategory(d);
            return cat && areaFilters.includes(cat);
        })
        .filter((d) => { // Date
            if (dateFilter === "") return true;
            return startDate <= new Date(d.lastTiming.end ?? d.end_date_time * 1000) && endDate >= new Date(d.firstTiming.begin ?? d.start_date_time * 1000);
        })

    // Split shortEvents vs longEvents
    // FIXME: This criterium is shit but will be improved later (e.g. use a specific keyword for longEvents)
    // Short events have no "-" in their dateRange, long events (3+ days) have
    let shortEvents = eventsFiltered.filter((d) => !d.dateRange.includes("-"));
    const longEvents = eventsFiltered.filter((d) => d.dateRange.includes("-"));
    // Feat: we use the next timing of long events to add one occurrence of it in short events list
    const longEventsNextTiming = longEvents.map((d) => {
        if (d.origin_agenda === "GRIST") return null;
        let newDateRange = DateTime.fromISO(d.nextTiming.begin, { zone: 'Europe/Paris' })
            .setLocale('fr')
            .toFormat("cccc d LLLL")
        newDateRange = newDateRange.charAt(0).toUpperCase() + newDateRange.slice(1);
        return ({ ...d, dateRange: newDateRange })
    }
    );
    shortEvents.push(...longEventsNextTiming);
    shortEvents = shortEvents.sort((a, b) => {
        const dateA = new Date(a.nextTiming?.begin ?? a.start_date_time * 1000);
        const dateB = new Date(b.nextTiming?.begin ?? b.start_date_time * 1000);
        return dateA - dateB;
    });

    // Turn the array into an object, the key is the event date range
    const shortEventsDayAgg = aggregatePerDay(shortEvents); // Object of { "Vendredi 18 octobre": [ { title, onlineAccessLink... } ] }
    const longEventsDayAgg = aggregatePerDay(longEvents); // Object of { "Vendredi 18 octobre - Lundi...": [ { title, onlineAccessLink... } ] }

    let shortContent = "";

    // Fill up #evenements-container with short events
    for (const d in shortEventsDayAgg) {
        const events = shortEventsDayAgg[d]
        if (events.length === 0) continue;

        shortContent += addDayContent(events, d);
    }
    document.getElementById("evenements-container").innerHTML = shortContent;

    let longContent = "";
    // Fill up #expositions-container with long events
    for (const d in longEventsDayAgg) {
        const events = longEventsDayAgg[d]
        if (events.length === 0) continue;

        longContent += addDayContent(events, d);
    }
    document.getElementById("expositions-container").innerHTML = longContent;

    // Add comment and link  to reach long events moved to bottom of page
    const EventsDivs = document.querySelectorAll('.dateAndEvents');
    if (EventsDivs.length >= 3) {
        const advertDiv = document.createElement('div');
        advertDiv.id = 'expoadvert';
        advertDiv.innerHTML = 'Les longs évènements (expos, festivals) sont <a href="#exposection">en bas de page';
        const thirdEvent = EventsDivs[2];
        thirdEvent.insertAdjacentElement('afterend', advertDiv);
    }
}

function aggregatePerDay(events) {
    const days = {};
    for (let i = 0; i < events.length; i++) {
        const d = events[i].dateRange.split(",")[0].replace(/\s\d{4}$/g, "");
        if (!days[d]) days[d] = [];
        days[d].push(events[i]);
    }
    return days;
}

function addDayContent(events, d) {
    let newContent = `<div>`;
    newContent += `<div class="dateAndEvents"><div class='date-header'><div class="sticky-date"><h4 >${d}</h4><p>░░░░░░░░░<p></div></div>`;
    newContent += `<div class='evenements'>`;
    for (let i = 0; i < events.length; i++) {
        // Main link
        const originAgenda = (events[i].origin_agenda) ? "GRIST" : "OPEN_AGENDA"
        if (originAgenda !== "GRIST") {
            const openAgendaLink = `https://openagenda.com/fr/${AGENDA_SLUG}/events/${events[i].slug}`;
            const registrationLink = events[i].registration?.find(item => item.value?.includes("https://"))?.value;
            const onlineAccessLink = (events[i].onlineAccessLink) ? events[i].onlineAccessLink : openAgendaLink;
            const redirectLink = registrationLink ? registrationLink : onlineAccessLink;
            // Event status
            const cancel = events[i].status === 6;
            const complet = events[i].status === 5;
            // Keywords
            const kws = (events[i].keywords) ? events[i].keywords.map((k) => k ? `<div class="tag"> #${k} </div>` : "") : [];
            // Timing and hidden OA link
            const openAgendaEditLink = `https://openagenda.com/fr/${AGENDA_SLUG}/contribute/event/${events[i].uid}`;
            const nextTime = (events[i].nextTiming) ? `<div class="time-tag"> <a href=${openAgendaEditLink} class="hidden-link" target="_blank">${events[i].nextTiming.begin.split("T")[1].slice(0, 5)} </a></div>` : "";
            // Main title
            const eventTitle = events[i].title.toLowerCase().toTitleCase()
            newContent += `<span class='evenement' title='${events[i].longDescription?.replace(/[&<>]/g, " ") ?? events[i].description?.replace(/[&<>]/g, " ")}'>
                                <div class="tag-container">${nextTime}  ${(kws.length > 0) ? kws.join("") : ""} </div>
                                <h2 class='card-title ${cancel ? "annule" : ""}'>
                                    ${cancel ? "<span >[ANNULÉ]</span>" : ""}
                                    ${complet ? "<span >[COMPLET]</span>" : ""}
                                    <a href=${redirectLink} target="_blank"> ${eventTitle} </a>
                                </h2>
                            <h3>⟜${events[i].location.name}, ${events[i].location.city}</h3>
                            <button class="add-to-cal" data-title="${escAttr(eventTitle)}" data-start="${escAttr(events[i].nextTiming?.begin ?? '')}" data-end="${escAttr(events[i].nextTiming?.end ?? '')}" data-location="${escAttr(events[i].location.name + ', ' + events[i].location.city)}" data-description="${escAttr(events[i].longDescription ?? events[i].description ?? '')}">+ Agenda</button>
                            </span>`;
        } else {
            // GRIST
            const redirectLink = events[i].registration ?? "https://grist.numerique.gouv.fr/o/docs/68gXbYioe7dj/goueliou/p/4";
            const cancel = events[i].status === "ANNULE"
            const complet = events[i].status === "COMPLET"
            const dateTime = DateTime.fromMillis(events[i].start_date_time * 1000)
            const nextTime = (events[i].start_date_time) ? `<div class="time-tag"> <a href=${"https://grist.numerique.gouv.fr/o/docs/68gXbYioe7dj/goueliou/p/4"} class="hidden-link" target="_blank">${dateTime.toFormat("hh:mm")} </a></div>` : "";
            const kws = (events[i].keywords) ? events[i].keywords.split(",").map((k) => k ? `<div class="tag"> #${k} </div>` : "") : [];
            const eventTitle = events[i].title.toLowerCase().toTitleCase()
            newContent += `<span class='evenement' title='${events[i].description?.replace(/[&<>]/g, " ")}'>
                                <div class="tag-container">${nextTime}  ${(kws.length > 0) ? kws.join("") : ""} </div>
                                <h2 class='card-title ${cancel ? "annule" : ""}'>
                                    ${cancel ? "<span >[ANNULÉ]</span>" : ""}
                                    ${complet ? "<span >[COMPLET]</span>" : ""}
                                    <a href=${redirectLink} target="_blank"> ${eventTitle} </a>
                                </h2>
                            <h3>⟜${events[i].location_name}, ${events[i].location_city}</h3>
                            <button class="add-to-cal" data-title="${escAttr(eventTitle)}" data-start="${escAttr(new Date(events[i].start_date_time * 1000).toISOString())}" data-end="${escAttr(new Date(events[i].end_date_time * 1000).toISOString())}" data-location="${escAttr((events[i].location_name ?? '') + ', ' + (events[i].location_city ?? ''))}" data-description="${escAttr(events[i].description ?? '')}">+ Agenda</button>
                            </span>`;
        }
    }
    newContent += `</div></div></div>`;
    return newContent;
}
