document.addEventListener('DOMContentLoaded', () => {
    // Setup the listener at page load
    // Build the content with default query
    // Then the visitor can interact
    const monthSelect = document.getElementById('monthSelect');
    monthSelect.value = "";  // Initialize date filter at page load
    let filters = []; // Initialize area filter at page load

    // Load default events without filtering by month
    if (localStorage.getItem("events") !== null) buildCalendar(null, filters);

    // Event listener for month selection
    monthSelect.addEventListener('change', () => {
        const selectedMonth = monthSelect.value;
        _paq.push(['trackEvent', 'Filtre mensuel', 'Changement', monthSelect.options[monthSelect.selectedIndex].text]);
        // Pass current filters along with the updated query
        buildCalendar(null, filters, selectedMonth);
    });

    // Add-to-calendar — event delegation (buttons are rendered dynamically)
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.add-to-cal');
        if (btn) addToCalendarClick(btn);
    });

    // Event listeners for distance-category filters: TRES PROCHE, PROCHE, MOINS PROCHE
    const filterButtons = document.getElementsByClassName('filter');
    for (let i = 0; i < filterButtons.length; i++) {
        filterButtons[i].addEventListener('click', () => {
            // Toggle active status of a distance button and update filter array
            const label = filterButtons[i].textContent.trim();
            if (filterButtons[i].classList.contains('selected')) {
                _paq.push(['trackEvent', 'Filtre distance', 'Déselection', label]);
                filterButtons[i].classList.remove('selected');
                filters = filters.filter((f) => f !== label);
            } else {
                _paq.push(['trackEvent', 'Filtre distance', 'Sélection', label]);
                filterButtons[i].classList.add('selected');
                filters.push(label);
            }
            // Get the selected month
            const selectedMonth = monthSelect.value;
            // Build the content
            buildCalendar(null, filters, selectedMonth);
        });
    }
});

