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
    console.log("evnts", evnts)
    const grist = await fetch('https://grist.numerique.gouv.fr/api/docs/68gXbYioe7dj/tables/Kerlandrier/records');
    const gristData = await grist.json();
    const gristEvnts = gristData.records.map((data) =>
        data.fields
    )

    const upcomingGristEvnts = gristEvnts.filter((e) => new Date <= new Date(e.end_date_time * 1000))

    const allEvnts = [...evnts.events, ...upcomingGristEvnts]

    const sortedAllEvnts = allEvnts.sort((a, b) => {
        const dateA = new Date(a.nextTiming?.begin ?? a.start_date_time * 1000);
        const dateB = new Date(b.nextTiming?.begin ?? b.start_date_time * 1000);
        return dateA - dateB;
    });

    // Store in local storage
    localStorage.setItem("events", JSON.stringify(sortedAllEvnts));

    buildCalendar(sortedAllEvnts);
}

const aven_cities = [
    "Bannalec", "Beg-Meil", "Concarneau", "Elliant", "LaForêt-Fouesnant", "Pleuven",
    "Pont-Aven", "Rosporden", "Fouesnant", "Melgven", "Moelansurmer", "Moëlan-sur-Mer",
    "Kervaziou", "Scaër", "Névez", "Nizon", "Port-la-Forêt", "Quimperlé", "Saint-Philibert",
    "Saint-Yvi", "Tourch", "Trégunc", "La Forêt-Fouesnant", "Mellac", "Querrien", "Autre"
]

// Add missing location description for cities in Aven, aggregated from other OACalendars out of Kerlandrier
function addLocDescription(evnts) {
    evnts.forEach((evnt) => {
        if (!evnt.location.description && aven_cities.some(city => evnt.location.city?.includes(city))) {
            evnt.location.description = "AVEN";
        }
    });
    return evnts;
}

function buildCalendar(evnts = null, areaFilters = [], dateFilter = "") {
    // Init date filters as Date
    const startDate = dateFilter ? new Date(dateFilter.split(",")[0]) : null;
    const endDate = dateFilter ? new Date(dateFilter.split(",")[1]) : null;

    // Get events from localStorage
    if (evnts === null) evnts = JSON.parse(localStorage.getItem("events"));

    // Add missing location description
    evnts = addLocDescription(evnts);

    // Filter events: area & date
    const eventsRaw = evnts; // Array of { title, onlineAccessLink... }
    const eventsFiltered = eventsRaw // Array of { title, onlineAccessLink... } but filtered based on location.description and selectedMonth
        .filter((d) => d.nextTiming || d.origin_agenda === "GRIST") // Make sure no shitty events gets displayed + shitty identification of Grist events
        .filter((d) => { // Area (Aven, Cornouaille, Bretagne)
            if (areaFilters.length === 0) return true;
            if (!d.location?.description) return false;
            console.log("d.location.description - ", d.location.description);
            return areaFilters.includes(d.location.description);
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
                            </span>`;
        }
    }
    newContent += `</div></div></div>`;
    return newContent;
}
