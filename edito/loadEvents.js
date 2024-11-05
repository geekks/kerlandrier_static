loadEvents()


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
    // Store in local storage
    localStorage.setItem("events_edit", JSON.stringify(evnts));

    buildTable(evnts);
}

function buildTable(evnts = null) {
    // Init date filters as Date
    console.log("localStorage.getItem - ", JSON.parse(localStorage.getItem("events_edit")));
    // Get events from localStorage
    if (evnts === null) evnts = JSON.parse(localStorage.getItem("events_edit"));
    // Filter events: area & date
    const eventsRaw = evnts.events.sort((a, b) => new Date(a.firstTiming.begin) - new Date(b.firstTiming.begin)); // Array of { title, onlineAccessLink... }
    // Build a table from eventsRaw
    const table = initTable();
    console.log("eventsRaw - ", eventsRaw.length);
    for (let i = 0; i < eventsRaw.length; i++) {
        const event = eventsRaw[i];
        createEventTable(table,event);
    }
}

function initTable() {
// Create table
      const table = document.createElement("table");
      table.border = 1;
      table.style.borderCollapse = "collapse";
      table.style.width = "100%";

      // Create table header row
      const headerRow = document.createElement("tr");
      const headers = ["Titre", "Dates", "Prochaine date", "Lien", "Lieu", "Ville", "Keywords"];

      headers.forEach(headerText => {
        const th = document.createElement("th");
        th.textContent = headerText;
        th.style.fontWeight = "bold";
        headerRow.appendChild(th);
      });
      table.appendChild(headerRow);
      return table
}

function createEventTable(table, event) {
  // Create event data row
  const dataRow = document.createElement("tr");

  // Fill in event data for each column
  const eventDataArray = [
    event.title,
    event.dateRange,
    new Date(event.nextTiming.begin).toLocaleDateString("fr-FR"),
    event.onlineAccessLink?.substring(0, 30) + "...",
    event.location.name,
    event.location.city,
  ];

  // Add regular data cells
  eventDataArray.forEach(dataText => {
    const td = document.createElement("td");
    td.textContent = dataText;
    td.style.textAlign = "center";
    td.style.padding = "5px";
    td.style.whiteSpace = "nowrap";
    dataRow.appendChild(td);
  });

  // Create a cell for keywords
  const keywordCell = document.createElement("td");
  keywordCell.style.paddingLeft = "5px";
  keywordCell.style.paddingRight = "5px";


  // Create a tag for each keyword
  event.keywords?.forEach(keyword => {
    const tag = document.createElement("span");
    tag.textContent = keyword;
    tag.style.display = "inline-block";
    tag.style.cursor = "pointer";
    tag.classList.add("tag");

     // Make the tag editable on click
    tag.addEventListener("click", () => makeTagEditable(tag, keywordCell));

    keywordCell.appendChild(tag);
  });

  dataRow.appendChild(keywordCell);
  table.appendChild(dataRow);

  // Append table to container if not already added
  if (!document.getElementById("table-container").contains(table)) {
    document.getElementById("table-container").appendChild(table);
  }
}

function createTagElement(text) {
  const tag = document.createElement("span");
  tag.textContent = text;
  tag.style.display = "inline-block";
  tag.style.display = "inline-block";
    tag.style.cursor = "pointer";
    tag.classList.add("tag");
  return tag;
}
// Function to make a tag editable
function makeTagEditable(tag, keywordCell) {
  const originalText = tag.textContent;
  
  // Create an input element to replace the tag text
  const input = document.createElement("input");
  input.value = originalText;
  input.type = "text";
    input.classList.add("tag");

  // Replace tag with input
  tag.replaceWith(input);
  input.focus();

  // Save changes on Enter key or when losing focus
  input.addEventListener("blur", () => {
    if (input.value.trim() === "") {
      tag.remove();
      input.remove();
    } else saveTagEdit(input, tag)
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        if (input.value.trim() === "") {
      tag.remove();
      input.remove();
    } else saveTagEdit(input, tag);
      // Move to the first tag in the keywords cell of the next row
      const currentRow = keywordCell.parentElement;
      const nextRow = currentRow.nextElementSibling;
      if (nextRow) {
          console.log("nextRow - ", nextRow);
          const nextKeywordCell = nextRow.cells[currentRow.cells.length - 1];
          const firstTagInNextRow = nextKeywordCell.querySelector("span");
          if (firstTagInNextRow) {
          makeTagEditable(firstTagInNextRow, nextKeywordCell);
          }
      } else {
          input.blur(); // No next row, let focus exit naturally
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      if (input.value.trim() === "") {
        tag.remove();
        input.remove();
      }
      saveTagEdit(input, tag);

      // Find the next sibling tag and make it editable
      const nextTag = tag.nextElementSibling;
      if (nextTag) {
        makeTagEditable(nextTag, keywordCell);
      }  else {
         // Create a new editable tag
        const newTag = createTagElement(""); // Empty new tag
        newTag.addEventListener("click", () => makeTagEditable(newTag, keywordCell));
        keywordCell.appendChild(newTag);
        makeTagEditable(newTag, keywordCell); // Immediately make the new tag editable
      }
    }
  });
}

// Function to save changes and replace input with tag
function saveTagEdit(input, tag) {
    tag.textContent = input.value || tag.textContent; // Revert to original if input is empty
    input.replaceWith(tag);
}

function generateUpdatedJSON() {
    const updatedEvents = Array.from(document.querySelectorAll("#table-container tr")).slice(1).map(row => {
    const cells = row.cells;
    const keywords = Array.from(cells[5].querySelectorAll("span")).map(tag => tag.textContent);

    return {
        title: cells[0].textContent,
        dateRange: cells[1].textContent,
        onlineAccessLink: cells[2].textContent,
        location: {
        name: cells[3].textContent.split(", ")[0],
        city: cells[3].textContent.split(", ")[1]
        },
        postalCode: cells[4].textContent,
        keywords: keywords
    };
    });

    const updatedJSON = { events: updatedEvents };
    document.getElementById("json-output").textContent = JSON.stringify(updatedJSON, null, 2);
}

// Add event listener to button to generate JSON
document.getElementById("generate-json-button").addEventListener("click", generateUpdatedJSON);