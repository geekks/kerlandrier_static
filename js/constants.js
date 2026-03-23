
const AGENDA_SLUG = "kerlandrier";
const AGENDA_UID = "44891982";
const PUBLIC_KEY = "886db2f2acd749bc9a4a3eeda9a6d0dc";
const URL = `https://api.openagenda.com/v2/agendas/${AGENDA_UID}/events`;
const maxEvents = 400;

// geographic area filters are no longer used; distance categories are calculated dynamically

// reference point used for distance calculations (DD coordinates)
const REFERENCE_COORDS = { // CONCARNEAU
    latitude: 47.87502,
    longitude: -3.92245
};

// thresholds in kilometres for the three distance categories
const DISTANCE_THRESHOLDS = {
    TRES_PROCHE: 5,   // <5 km
    PROCHE: 25        // <25 km (MOINS PROCHE otherwise)
};


const defaultParams = {
    // relative: ['current', 'upcoming'], // Do not use this, OpenAgenda params are not standard
    sort: 'timings.asc',
    detailed: 0,
    key: PUBLIC_KEY,
    size: maxEvents,
    monolingual: "fr",
};

const includeFields = ["uid","slug", "title", "onlineAccessLink","registration", "status", "keywords", "dateRange", "location.description", "nextTiming", "longDescription", "description", "location.name", "location.city", "location.latitude", "location.longitude", "keywords"]

const defaultQuery = URL + "?" 
+ new URLSearchParams(defaultParams).toString()
+ "&" + "relative[]=current&relative[]=upcoming"
// includeFields params are not standard, build it manually
+ "&" + includeFields.map(field => `includeFields[]=${field}`).join("&");
let filters = [];
