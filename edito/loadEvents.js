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
  // Get events from localStorage
  if (evnts === null) evnts = JSON.parse(localStorage.getItem("events_edit"));
  // Filter events: area & date
  const eventsRaw = evnts.events.sort((a, b) => new Date(a.firstTiming.begin) - new Date(b.firstTiming.begin)); // Array of { title, onlineAccessLink... }
  // Build a table from eventsRaw
  const table = initTable();
  for (let i = 0; i < eventsRaw.length; i++) {
    const event = eventsRaw[i];
    createEventTable(table, event);
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
  const headers = ["Slug", "Uid", "Titre", "Dates", "Prochaine date", "Lien", "Lieu", "Ville", "Keywords ❔"];
  headers.forEach(headerText => {
    const th = document.createElement("th");
    th.textContent = headerText;
    th.style.fontWeight = "bold";
    if (headerText === "Keywords ❔") {
      th.title = "Cliquer sur un mot pour éditer\nTab mot suivant\nEntrer ligne suivante";
      const span = document.createElement("p");
      span.textContent = "Cliquer sur un mot pour éditer\nTab mot suivant\nEntrer ligne suivante";
      span.style.fontFamily = "monospace";
      span.style.fontSize = "12px";
      span.style.whiteSpace = "pre";
      th.appendChild(document.createElement("br"));
      th.appendChild(span);
    }
    headerRow.appendChild(th);
  });
  table.appendChild(headerRow);
  return table
}

function createEventTable(table, event) {
  // Init event data row
  const dataRow = document.createElement("tr");

  // Fill in row data for each column
  const eventDataArray = [
    event.slug,
    event.uid,
    event.title,
    event.dateRange,
    new Date(event.nextTiming.begin).toLocaleDateString("fr-FR"),
    event.onlineAccessLink,
    event.location.name,
    event.location.city,
  ];

  // Add regular data cells
  eventDataArray.forEach((dataText, index) => {
      const td = document.createElement("td");
      td.style.textAlign = "center";
      td.style.paddingLeft = "5px";
      td.style.paddingRight = "5px";
      if (index === 0) {
        const link = document.createElement("a");
        link.href = `${PUBLIC_URL}/${dataText}`;
        link.textContent = dataText;
        td.appendChild(link);
      } else {
        td.textContent = dataText;
      }
      dataRow.appendChild(td);
  });

  // Create a cell for keywords
  const keywordCell = document.createElement("td");
  keywordCell.style.padding = "5px";
  // // Enable the user to add a keyword if the list is empty
  // // i.e. add an event listener that adds a tag on first click
  // if (!event.keywords || event.keywords?.length === 0) {
    keywordCell.addEventListener("click", () => {
      // Create a new editable tag
      const newTag = createTagElement(""); // Empty new tag
      newTag.addEventListener("click", () => makeTagEditable(newTag, keywordCell));
      keywordCell.appendChild(newTag);
      makeTagEditable(newTag, keywordCell);
    }, { once: true });
  // }

  // Create a tag for each keyword
  event.keywords?.forEach(keyword => {
    const tag = document.createElement("span");
    tag.textContent = keyword;
    tag.style.display = "inline-block";
    tag.style.cursor = "pointer";
    tag.classList.add("tag");

    // Make the tag editable on click
    tag.addEventListener("click", (event) => {
      event.stopPropagation();
      makeTagEditable(tag, keywordCell)
    });
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

  let isSaved = false; // Flag to prevent multiple save calls and conflict between onBlur, onTab...

  // Replace tag with input
  if (tag.parentNode) tag.replaceWith(input);
  input.focus();

  // Save changes on blur
  input.addEventListener("blur", () => {
    if (input.value.trim() === "") {
      tag.remove();
      input.remove();
    }
    else if (!isSaved) {
      isSaved = true; // Set the flag to prevent further calls
      saveTagEdit(input, tag);
    }
  });

  // On Escape trigger blur event
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      input.blur();
    }
  });

  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      // Save changes on and go to next row Enter
      if (!isSaved) {
        isSaved = true;
        if (input.value.trim() === "") {
          input.blur()
        } else {
          saveTagEdit(input, tag);
        }
      }
      // Move to the first tag in the keywords cell of the next row
      const currentRow = keywordCell.parentElement;
      const nextRow = currentRow.nextElementSibling;
      if (nextRow) {
        const nextKeywordCell = nextRow.cells[currentRow.cells.length - 1];
        const firstTagInNextRow = nextKeywordCell.querySelector("span");
        if (firstTagInNextRow) {
          makeTagEditable(firstTagInNextRow, nextKeywordCell);
        } else {
          // Create a new editable tag
          const newTag = createTagElement(""); // Empty new tag
          newTag.addEventListener("click", () => makeTagEditable(newTag, nextKeywordCell));
          nextKeywordCell.appendChild(newTag);
          makeTagEditable(newTag, nextKeywordCell);
        }
      } else {
        input.blur(); // No next row, let focus exit naturally
      }
    } else if (e.key === "Tab") {
      // Save changes on and go to next tag on Tab
      e.preventDefault();
      const nextInput = input.nextElementSibling;
      if (input.value.trim() === "" && !nextInput) return;
      
      if (!isSaved) {
        isSaved = true;
        if (input.value.trim() === "") {
          input.blur()
        } else {
          saveTagEdit(input, tag);
        }
        
        // Find the next sibling tag or create a new one
        const nextTag = tag.nextElementSibling;
        if (nextTag) {
          // Case when input is not empty hence not deleted
          makeTagEditable(nextTag, keywordCell);
        } else if (nextInput) {
          // Case when input is empty hence deleted
          makeTagEditable(nextInput, keywordCell);
        } else {
          // Default case i.e. new tag
          const newTag = createTagElement("");
          newTag.addEventListener("click", () => makeTagEditable(newTag, keywordCell));
          keywordCell.appendChild(newTag);
          makeTagEditable(newTag, keywordCell);
        }
      }
    }
  });
}

// Function to save changes and replace input with tag
function saveTagEdit(input, tag) {
  tag.textContent = input.value || tag.textContent; // Revert to original if input is empty
  if (input.parentNode) input.replaceWith(tag);
}

async function generateUpdatedJSON() {
  const updatedEvents = Array.from(document.querySelectorAll("#table-container tr")).slice(1).map(row => {
    const cells = row.cells;
    const keywords = Array.from(cells[8].querySelectorAll("span")).map(tag => tag.textContent);
    
    return {
      uid: cells[1].textContent,
      slug: cells[0].querySelector("a").textContent,
      keywords: keywords
    };
  });

  document.getElementById("json-output").textContent = "Work in progress...";
  const patch = await axios.patch(
    `http://localhost:8001/events/keywords`,
    { events: updatedEvents },
    {
      headers: {
        "Content-Type": "application/json"
      }
    }
  );
  document.getElementById("json-output").textContent = JSON.stringify(patch.data, null, 2);
}

// Add event listener to button to generate JSON
document.getElementById("generate-json-button").addEventListener("click", (generateUpdatedJSON));