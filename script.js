// Global variables
let exchangeRates = {};
let currencyLines = [];
let baseCurrency = 'USD';
let lastUpdated = null;
let calculationTimeout = null;

// Currency to country code mapping for flags
const currencyToCountry = {
    'USD': 'us', 'EUR': 'eu', 'JPY': 'jp', 'GBP': 'gb', 'AUD': 'au', 'CAD': 'ca',
    'CHF': 'ch', 'CNY': 'cn', 'HKD': 'hk', 'KRW': 'kr', 'SGD': 'sg', 'THB': 'th',
    'VND': 'vn', 'DKK': 'dk', 'NOK': 'no', 'SEK': 'se', 'INR': 'in', 'MYR': 'my',
    'RUB': 'ru', 'SAR': 'sa', 'KWD': 'kw'
};

// Fixed top currencies (always appear first)
const topCurrencies = ['VND', 'THB', 'USD', 'CNY'];

// Other available currencies from Vietcombank
const otherCurrencies = [
    'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'HKD',
    'SGD', 'KRW', 'DKK', 'NOK', 'SEK', 'INR', 'MYR', 
    'RUB', 'SAR', 'KWD'
];

// Fetch exchange rates from Vietcombank
async function fetchExchangeRates() {
    const loadingEl = document.getElementById('loading');
    const errorEl = document.getElementById('error');
    const currencyLinesEl = document.getElementById('currencyLines');

    try {
        loadingEl.style.display = 'flex';
        errorEl.classList.add('hidden');

        // Use a CORS proxy to fetch the XML data
        const proxyUrl = 'https://api.allorigins.win/get?url=';
        const targetUrl = 'https://portal.vietcombank.com.vn/Usercontrols/TVPortal.TyGia/pXML.aspx';
        
        const response = await fetch(proxyUrl + encodeURIComponent(targetUrl));
        const data = await response.json();
        
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(data.contents, 'text/xml');
        
        const exrateList = xmlDoc.getElementsByTagName('ExrateList')[0];
        if (exrateList) {
            const dateTime = exrateList.getAttribute('DateTime');
            // Parse the DateTime format "M/d/yyyy h:mm:ss tt"
            lastUpdated = new Date(dateTime);
            updateLastUpdatedDisplay();
        }

        const rates = xmlDoc.getElementsByTagName('Exrate');
        exchangeRates = { 'VND': 1 }; // VND is the base currency

        for (let rate of rates) {
            const currencyCode = rate.getAttribute('CurrencyCode');
            const sellRateStr = rate.getAttribute('Sell');
            
            // Skip currencies with no sell rate or "-"
            if (sellRateStr && sellRateStr !== '-') {
                const sellRate = parseFloat(sellRateStr.replace(/,/g, ''));
                if (!isNaN(sellRate) && sellRate > 0) {
                    exchangeRates[currencyCode] = sellRate;
                }
            }
        }

        loadingEl.style.display = 'none';
        initializeCurrencyLines();

    } catch (error) {
        console.error('Error fetching exchange rates:', error);
        loadingEl.style.display = 'none';
        errorEl.classList.remove('hidden');
    }
}

// Update last updated display
function updateLastUpdatedDisplay() {
    const lastUpdatedEl = document.getElementById('lastUpdated');
    if (lastUpdated) {
        lastUpdatedEl.textContent = `Last updated: ${lastUpdated.toLocaleString()}`;
    }
}

// Initialize currency lines
function initializeCurrencyLines() {
    const currencyLinesEl = document.getElementById('currencyLines');
    currencyLinesEl.innerHTML = '';
    currencyLines = [];

    // Always create lines for top currencies first
    topCurrencies.forEach((currency) => {
        if (exchangeRates[currency] !== undefined) {
            createCurrencyLine(currency, currency === 'USD');
        }
    });

    // Then add other currencies that have exchange rates
    otherCurrencies.forEach((currency) => {
        if (exchangeRates[currency] !== undefined) {
            createCurrencyLine(currency, false);
        }
    });

    // Set USD as default input currency if available, otherwise use VND
    if (exchangeRates['USD']) {
        setInputCurrency('USD');
    } else if (exchangeRates['VND']) {
        setInputCurrency('VND');
    }

    calculateExchangeRates();
}

// Create a currency line element
function createCurrencyLine(currency, isInput = false) {
    const line = document.createElement('div');
    line.className = `currency-line ${isInput ? 'input-line' : ''}`;
    line.dataset.currency = currency;

    // Flag
    const flag = document.createElement('img');
    const countryCode = currencyToCountry[currency] || currency.toLowerCase();
    flag.src = `https://flagcdn.com/48x36/${countryCode}.png`;
    flag.alt = `${currency} flag`;
    flag.className = 'currency-flag';
    flag.onerror = () => {
        flag.src = `https://via.placeholder.com/48x36/3b82f6/ffffff?text=${currency}`;
    };

    // Currency symbol
    const symbol = document.createElement('div');
    symbol.className = 'currency-symbol';
    symbol.textContent = currency;

    // Input field
    const input = document.createElement('input');
    input.type = 'number';
    input.className = 'currency-input';
    input.placeholder = '0.00';
    input.step = '0.01';
    input.min = '0';

    // Event listeners
    line.addEventListener('click', (e) => {
        if (!line.classList.contains('input-line')) {
            setInputCurrency(currency);
        } else {
            // If already input line, select all text in the input
            input.select();
        }
        e.preventDefault();
    });

    input.addEventListener('input', (e) => {
        if (line.classList.contains('input-line')) {
            calculateExchangeRates();
        }
    });

    input.addEventListener('focus', (e) => {
        if (!line.classList.contains('input-line')) {
            setInputCurrency(currency);
        } else {
            // Select all text when focusing on input line
            setTimeout(() => e.target.select(), 0);
        }
    });

    input.addEventListener('click', (e) => {
        if (line.classList.contains('input-line')) {
            // Select all text when clicking on input
            e.target.select();
            e.stopPropagation();
        }
    });

    line.appendChild(flag);
    line.appendChild(symbol);
    line.appendChild(input);

    const currencyLinesEl = document.getElementById('currencyLines');
    currencyLinesEl.appendChild(line);
    currencyLines.push(line);

    return line;
}

// Set which currency is the input currency
function setInputCurrency(currency) {
    // Remove input-line class from all lines
    currencyLines.forEach(line => {
        line.classList.remove('input-line');
    });

    // Find and set the new input line
    const newInputLine = currencyLines.find(line => line.dataset.currency === currency);
    if (newInputLine) {
        newInputLine.classList.add('input-line');
        baseCurrency = currency;
        
        // Reorganize lines to maintain fixed order: VND, THB, USD, CNY at top
        reorganizeCurrencyLines();
        
        // Focus the input and select all text
        const input = newInputLine.querySelector('.currency-input');
        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);

        calculateExchangeRates();
    }
}

// Reorganize currency lines to maintain the fixed order
function reorganizeCurrencyLines() {
    const currencyLinesEl = document.getElementById('currencyLines');
    const allLines = Array.from(currencyLinesEl.children);
    
    // Clear the container
    currencyLinesEl.innerHTML = '';
    
    // Add top currencies first
    topCurrencies.forEach(currency => {
        const line = allLines.find(l => l.dataset.currency === currency);
        if (line) {
            currencyLinesEl.appendChild(line);
        }
    });
    
    // Then add other currencies
    otherCurrencies.forEach(currency => {
        const line = allLines.find(l => l.dataset.currency === currency);
        if (line) {
            currencyLinesEl.appendChild(line);
        }
    });
}



// Manual refresh function
async function manualRefresh() {
    const refreshBtn = document.getElementById('refreshBtn');
    const originalText = refreshBtn.innerHTML;
    
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = '🔄 Refreshing...';
    
    try {
        await fetchExchangeRates();
    } catch (error) {
        console.error('Manual refresh failed:', error);
    }
    
    refreshBtn.disabled = false;
    refreshBtn.innerHTML = originalText;
}// Calculate and update all exchange rates
function calculateExchangeRates() {
    // Use debounce for mobile performance
    if (calculationTimeout) {
        clearTimeout(calculationTimeout);
    }
    
    calculationTimeout = setTimeout(() => {
        const inputLine = document.querySelector('.currency-line.input-line');
        if (!inputLine) return;

        // Remove commas and any non-numeric characters except decimal point
        const rawInputValue = inputLine.querySelector('.currency-input').value;
        const cleanInputValue = rawInputValue.replace(/[,\s]/g, '').replace(/[^\d.-]/g, '');
        const inputAmount = parseFloat(cleanInputValue) || 0;
        
        currencyLines.forEach(line => {
            const currency = line.dataset.currency;
            const input = line.querySelector('.currency-input');

            if (currency === baseCurrency || line.classList.contains('input-line')) {
                // This is the input line, NEVER format it - keep user input as-is
                return;
            }

        let convertedAmount = 0;
        
        // Vietcombank rates are VND per 1 unit of foreign currency
        // Formula: Amount_A × (Rate_A ÷ Rate_B) = Amount_B
        
        if (baseCurrency === 'VND') {
            // Converting FROM VND TO foreign currency
            // VND_amount ÷ foreign_rate = foreign_amount
            if (exchangeRates[currency]) {
                convertedAmount = inputAmount / exchangeRates[currency];
            }
        } else if (currency === 'VND') {
            // Converting FROM foreign currency TO VND  
            // foreign_amount × foreign_rate = VND_amount
            if (exchangeRates[baseCurrency]) {
                convertedAmount = inputAmount * exchangeRates[baseCurrency];
            }
        } else {
            // Converting between two foreign currencies
            // Formula: input_amount × (input_rate ÷ target_rate)
            if (exchangeRates[baseCurrency] && exchangeRates[currency]) {
                convertedAmount = inputAmount * (exchangeRates[baseCurrency] / exchangeRates[currency]);
            }
        }
        

        // NO FORMATTING - just show the numbers with basic decimals
        if (convertedAmount === 0 || isNaN(convertedAmount)) {
            input.value = "0.00";
        } else if (convertedAmount >= 1) {
            input.value = convertedAmount.toFixed(2);} else {
            input.value = convertedAmount.toFixed(4);
        }
    });
    }, 100); // 100ms debounce for better mobile performance
}

// Initialize the application
document.addEventListener('DOMContentLoaded', () => {
    fetchExchangeRates();
    
    // Refresh rates every 5 minutes
    setInterval(fetchExchangeRates, 5 * 60 * 1000);
});