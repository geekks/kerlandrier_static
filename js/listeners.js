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
        let query = defaultQuery;
        const selectedMonth = monthSelect.value;
        _paq.push(['trackEvent', 'Filtre mensuel', 'Changement', monthSelect.options[monthSelect.selectedIndex].text]);
        // Pass current filters along with the updated query
        buildCalendar(null, filters, selectedMonth);
    });

    // Event listeners for area filters: AVEN, CORNOUAILLE, BRETAGNE
    const filterButtons = document.getElementsByClassName('filter');
    for (let i = 0; i < filterButtons.length; i++) {
        filterButtons[i].addEventListener('click', () => {
            // Toggle active status of the area button
            // Toggle area in filter used by buildCalendar
            if (filterButtons[i].classList.contains('selected')) {
                _paq.push(['trackEvent', 'Filtre géographique', 'Déselection zone', filterButtons[i].textContent]);
                filterButtons[i].classList.remove('selected');
                filters = filters.filter((f) => f !== filterButtons[i].textContent);
            } else {
                _paq.push(['trackEvent', 'Filtre géographique', 'Sélection zone', filterButtons[i].textContent]);
                filterButtons[i].classList.add('selected');
                filters.push(filterButtons[i].textContent);
            }
            // Get the selected month
            const selectedMonth = monthSelect.value;
            // Build the content
            buildCalendar(null, filters, selectedMonth);
        });
    }
});