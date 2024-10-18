loadEvents()


/**
 * Charge les événements sur la page
 * @param {string} [query] - url de la requête pour récupérer les événements
 * @param {string[]} [filters] - filtres pour afficher/masquer des événements
 * @returns {Promise<void>}
 */
async function loadEvents(query = defaultQuery, filters = []) {
    console.log("query - ", query);
    const response = await fetch(query);
    const evnts = await response.json();
    // Store in local storage
    localStorage.setItem("events", JSON.stringify(evnts));
    const evntsDaysNotSorted = aggregatePerDay(evnts.events);
    const evntsDays = longEventsToBottom(evntsDaysNotSorted)

    let content = "";
    const DayKeys = Object.keys(evntsDays);
    const lastDayKey = DayKeys[DayKeys.length - 1];
    for (const d in evntsDays) {
        const events = evntsDays[d].filter((d) => {
            if (filters.length === 0) return true;
            return filters.includes(d.location.description.fr);
        });

        if (events.length === 0) continue;

        content += `<div>`;
        content += `<div class="dateAndEvents"><h4 class='date-header'>${d}</h4>`;
        content += `<div class='evenements'>`;
        for (let i = 0; i < events.length; i++) {
            const openAgendaLink = `https://openagenda.com/fr/${AGENDA_SLUG}/events/${events[i].slug}`;
            const redirectLink = (events[i].onlineAccessLink) ? events[i].onlineAccessLink : openAgendaLink;
            const cancel = events[i].status === 6;
            const kws = (events[i].keywords) ? events[i].keywords.map((k) => k ? `<div class="tag"> #${k} </div>` : "") : [];
            if (events[i].location.description.fr) kws.push(`<div class="time-tag"> #${events[i].location.description.fr} </div>`);
            const nextTime = (events[i].nextTiming) ? `<div class="time-tag"> <a href=${openAgendaLink} class="hidden-link" target="_blank">${events[i].nextTiming.begin.split("T")[1].slice(0, 5)} </a></div>` : "";
            content += `<span class='evenement' title='${events[i].longDescription?.replace(/[&<>]/g, " ") ?? events[i].description?.replace(/[&<>]/g, " ")}'>
                            ${(kws.length > 0) ? kws.join("") : ""} ${nextTime}
                            <h2 class='card-title ${cancel ? "annule" : ""}'>
                                ${cancel ? "<span >[ANNULÉ]</span>" : ""}
                                <a href=${redirectLink} target="_blank"> ${events[i].title} </a>
                            </h2>
                        <h3>⟜${events[i].location.name}, ${events[i].location.city}</h3>
                        </span>`;
        }
        content += `</div></div></div>`;

        if (d == lastDayKey && !document.getElementById('monthSelect').value) {
            content += `<div id="other-events"> <br/><br/>
                            <p> .... pour voir plus d'évènements, <a href="#filters-container">sélectionnez un mois </a></p> 
                        </div>`;
        }
    }
    document.getElementById("evenements-container").innerHTML = content;

    // Add comment link and to reach long events moved to bottom of page 
    const EventsDivs = document.querySelectorAll('.dateAndEvents');
    if (EventsDivs.length >= 3) {
        const advertDiv = document.createElement('div');
        advertDiv.id = 'expoadvert';
        advertDiv.innerHTML =  'Les longs evenements (expos, festival) sont <a href="#exposection">en bas de page';
        const thirdEvent = EventsDivs[2];
        thirdEvent.insertAdjacentElement('afterend', advertDiv);
    }
}

function aggregatePerDay(events) {
    const days = {};
    for (let i = 0; i < events.length; i++) {
        console.log("events[i].dateRange - ", events[i].dateRange);
        const d = events[i].dateRange.split(",")[0];
        if (!days[d]) days[d] = [];
        days[d].push(events[i]);
    }
    return days;
}

// Avoid keeping long events on top during all their duration by moving them bottom list.
function longEventsToBottom(evntsDays) {
    const reorderedDays = {};
    const rangeDays = [];
    const singleDay = [];
    for (const day in evntsDays) {
        if (day.includes('-') ) rangeDays.push(day);
        else singleDay.push(day);
        }
    singleDay.forEach( day => { reorderedDays[day] = evntsDays[day] });
    rangeDays.forEach( day => { reorderedDays[day] = evntsDays[day] });
    return reorderedDays;
}