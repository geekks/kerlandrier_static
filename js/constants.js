
const AGENDA_SLUG = "kerlandrier";
const AGENDA_UID = "44891982";
const PUBLIC_KEY = "886db2f2acd749bc9a4a3eeda9a6d0dc";
const URL = `https://api.openagenda.com/v2/agendas/${AGENDA_UID}/events`;
const maxEvents = 150;

const defaultParams = {
    relative: ['current', 'upcoming'],
    detailed: 0,
    key: PUBLIC_KEY,
    size: maxEvents,
    monolingual: "fr",
};

const includeFields = ["slug", "title", "onlineAccessLink", "status", ,"keywords", "dateRange", "location.description", "nextTiming", "longDescription", "description", "location.name", "location.city"]

const defaultQuery = URL + "?" 
+ new URLSearchParams(defaultParams).toString()
// includeFields params are not standard, build it manually
+ "&" + includeFields.map(field => `includeFields[]=${field}`).join("&");
let filters = [];
