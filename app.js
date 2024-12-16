// Firebase SDK Imports
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.17.1/firebase-app.js";
import {
    getAuth,
    signInWithEmailAndPassword,
    onAuthStateChanged,
    signOut
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-auth.js";
import {
    getFirestore,
    collection,
    getDoc,
    doc,
    setDoc,
    query,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/9.17.1/firebase-firestore.js";

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAN2ZXKYzFoJ0o__qAyVxubjit3wrlEGlo",
    authDomain: "meldepunktpro.firebaseapp.com",
    projectId: "meldepunktpro",
    storageBucket: "meldepunktpro.appspot.com",
    messagingSenderId: "1084931878712",
    appId: "1:1084931878712:web:bfa5e31c03fad5e1015bcd"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM Elements
const authSection = document.getElementById("auth-section");
const menuSection = document.getElementById("menu-section");
const content = document.getElementById("content");

// Global state for the current Anlage ID
let currentAnlageId = null;
let selectedQuartal = 'Q1'; // Default value for the quarter
let selectedYear = new Date().getFullYear(); // Default year
let showOnlyOpen = false;   // Filter for open points
let filterByQuarter = null; // To store which quarter to filter the display (via buttons)

// Event listener for login button click
document.getElementById("login-button").addEventListener("click", async () => {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Fehler beim Anmelden: ${error.message}`);
    }
});

document.getElementById("password").addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
        triggerLogin();
    }
});

// Function to trigger login process
async function triggerLogin() {
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        alert(`Fehler beim Anmelden: ${error.message}`);
    }
}

document.getElementById("logout-button").addEventListener("click", async () => {
    await signOut(auth);
});

document.getElementById("search-submit").addEventListener("click", showSearchPage);
document.getElementById("create-submit").addEventListener("click", showCreatePage);

// Authentication State Change
onAuthStateChanged(auth, (user) => {
    if (user) {
        authSection.style.display = "none";
        menuSection.style.display = "block";
        showSearchPage();  // Show search page after login
    } else {
        authSection.style.display = "block";
        menuSection.style.display = "none";
        content.innerHTML = "<p>Bitte loggen Sie sich ein.</p>";
    }
});

// Event listener for the "CheckInspect" link
document.getElementById("checkinspect-link").addEventListener("click", () => {
    showSearchPage(); // Zeigt die Such-Seite an
});

// Event listener for the Refresh button
document.getElementById("refresh-button").addEventListener("click", () => {
    const currentPage = content.innerHTML;

    if (currentPage.includes("Anlage Suchen")) {
        showSearchPage();
    } else if (currentPage.includes("Neue Anlage Erstellen")) {
        showCreatePage();
    } else if (currentPage.includes("Anlage:")) {
        if (currentAnlageId) {
            showAnlagePruefung(currentAnlageId);
        } else {
            alert("Keine gültige Anlage-ID gefunden.");
        }
    }
});

// Search Page
async function showSearchPage() {
    content.innerHTML = `
        <h2>Anlage Suchen</h2>
        <input type="text" id="search-term" placeholder="Anlagen-Nr oder Name">
        <button id="perform-search">Suchen</button>
        <div id="search-results"></div>
    `;

    // Event listener for search button click
    document.getElementById("perform-search").addEventListener("click", performSearch);

    // Event listener for Enter key press
    document.getElementById("search-term").addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
            performSearch();  // Trigger search when Enter is pressed
        }
    });

    // Perform search logic
    async function performSearch() {
        const searchTerm = document.getElementById("search-term").value.trim().toLowerCase();
        if (!searchTerm) {
            alert("Bitte einen Suchbegriff eingeben.");
            return;
        }

        try {
            const q = query(collection(db, "anlagen"));
            const querySnapshot = await getDocs(q);
            const resultsContainer = document.getElementById("search-results");

            resultsContainer.innerHTML = ""; // Clear previous results

            let foundResults = [];
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                const nameLower = data.name.toLowerCase();
                const idLower = data.id.toLowerCase();

                if (nameLower.includes(searchTerm) || idLower.includes(searchTerm)) {
                    foundResults.push(data);
                }
            });

            if (foundResults.length === 0) {
                resultsContainer.innerHTML = "<p>Keine Ergebnisse gefunden.</p>";
            } else {
                foundResults.forEach((data) => {
                    resultsContainer.innerHTML += `
                        <div>
                            <p><strong>${data.name}</strong> (Anlagen-Nr: ${data.id})</p>
                            <p>Meldergruppen: ${data.meldergruppen.length}</p>
                            <p>Geprüft: ${calculateProgress(data.meldergruppen)}%</p>
                            <button class="open-anlage" data-id="${data.id}">Zur Prüfung</button>
                        </div>
                        <hr>
                    `;
                });

                document.querySelectorAll(".open-anlage").forEach((button) => {
                    button.addEventListener("click", (e) => {
                        const anlageId = e.target.getAttribute("data-id");
                        currentAnlageId = anlageId;
                        showAnlagePruefung(anlageId);
                    });
                });
            }
        } catch (error) {
            alert(`Fehler bei der Suche: ${error.message}`);
        }
    }
}

// Create Page
async function showCreatePage() {
    content.innerHTML = `
        <h2>Neue Anlage Erstellen</h2>
        <input type="text" id="new-name" placeholder="Anlagenname">
        <input type="text" id="new-id" placeholder="Anlagen-Nr">
        <div id="meldergruppen-container">
            <div class="meldergruppe">
                <h3>Meldegruppe 1</h3>
                <input type="number" class="melder-count" placeholder="Anzahl Melder" value="1">
                <label for="zd">ZD</label>
                <input type="checkbox" class="zd-checkbox">
                <label for="sm">SM</label>
                <input type="checkbox" class="sm-checkbox">
            </div>
        </div>
        <button id="add-meldegruppe">Weitere Meldegruppe hinzufügen</button>
	<br>
	<br>
        <button id="create-new">Anlage Erstellen</button>
    `;

    // Add a new Meldegruppe
    document.getElementById("add-meldegruppe").addEventListener("click", () => {
        const meldergruppenContainer = document.getElementById("meldergruppen-container");
        const groupCount = meldergruppenContainer.querySelectorAll(".meldergruppe").length + 1;
        const newGroup = document.createElement("div");
        newGroup.classList.add("meldergruppe");
        newGroup.innerHTML = `
            <h3>Meldegruppe ${groupCount}</h3>
            <input type="number" class="melder-count" placeholder="Anzahl Melder" value="1">
            <label for="zd">ZD</label>
            <input type="checkbox" class="zd-checkbox">
            <label for="sm">SM</label>
            <input type="checkbox" class="sm-checkbox">
        `;
        meldergruppenContainer.appendChild(newGroup);
    });

    // Create the new Anlage
    document.getElementById("create-new").addEventListener("click", async () => {
        const name = document.getElementById("new-name").value;
        const id = document.getElementById("new-id").value;

        // Collect all Meldegruppen data
        const meldergruppen = [];
        document.querySelectorAll(".meldergruppe").forEach((groupElement, index) => {
            const melderCount = parseInt(groupElement.querySelector(".melder-count").value, 10);
            const zdChecked = groupElement.querySelector(".zd-checkbox").checked;
            const smChecked = groupElement.querySelector(".sm-checkbox").checked;
            
            const meldepunkte = Array.from({ length: melderCount }, (_, i) => ({
                id: i + 1,
                geprüft: false,
                quartal: null,
                jahre: [], // Array to store years of inspection
            }));

            meldergruppen.push({
                name: `MG${index + 1}`,
                meldepunkte: meldepunkte,
                zd: zdChecked,
                sm: smChecked,
            });
        });

        try {
            await setDoc(doc(db, "anlagen", id), { name, id, meldergruppen });
            alert("Anlage erfolgreich erstellt!");
        } catch (error) {
            alert(`Fehler beim Erstellen der Anlage: ${error.message}`);
        }
    });
}

// Function to display the Anlage Prüfung page
async function showAnlagePruefung(anlageId) {
    const anlageDoc = await getDoc(doc(db, "anlagen", anlageId));
    if (!anlageDoc.exists()) {
        alert("Anlage nicht gefunden!");
        return;
    }

    const anlageData = anlageDoc.data();

    // Render page with Quartal and Year selection
    content.innerHTML = `
        <h2>Anlage: ${anlageData.name} (Anlagen-Nr: ${anlageData.id})</h2>
        <div>
            <label for="year-select">Wählen Sie das Prüf-Jahr:</label>
            <select id="year-select">
                <option value="${selectedYear}" selected>${selectedYear}</option>
                <option value="${selectedYear - 1}">${selectedYear - 1}</option>
                <option value="${selectedYear + 1}">${selectedYear + 1}</option>
            </select>
            <label for="quartal-select">Wählen Sie das Prüf-Quartal:</label>
            <select id="quartal-select">
                <option value="Q1" ${selectedQuartal === 'Q1' ? 'selected' : ''}>Q1</option>
                <option value="Q2" ${selectedQuartal === 'Q2' ? 'selected' : ''}>Q2</option>
                <option value="Q3" ${selectedQuartal === 'Q3' ? 'selected' : ''}>Q3</option>
                <option value="Q4" ${selectedQuartal === 'Q4' ? 'selected' : ''}>Q4</option>
            </select>
        </div>
        <div id="anlage-pruefung">
            ${anlageData.meldergruppen
                .filter(gruppe => gruppe.meldepunkte.length > 0) // Only Meldegruppen with points
                .map((gruppe) => ` 
                <div>
                    <h3>${gruppe.name} ${gruppe.zd ? "(ZD)" : ""} ${gruppe.sm ? "(SM)" : ""}</h3>
                    <div class="melder-container">
                        ${gruppe.meldepunkte
                            .filter((melder) =>
                                showOnlyOpen
                                    ? !melder.geprüft || melder.jahre.includes(selectedYear)
                                    : true
                            )
                            .map(
                                (melder) => ` 
                            <span>
                                ${melder.id}
                                <input type="checkbox" class="melder-checkbox" data-group="${gruppe.name}" data-melder="${melder.id}" ${melder.geprüft ? 'checked' : ''}>
                            </span>
                        `).join('') }
                    </div>
                </div>
            `).join('') }
        </div>
    `;

    // Event listeners for Year and Quartal selection
    document.getElementById("year-select").addEventListener("change", (e) => {
        selectedYear = e.target.value;
        showAnlagePruefung(anlageId);  // Re-render with new year
    });

    document.getElementById("quartal-select").addEventListener("change", (e) => {
        selectedQuartal = e.target.value;
    });

    // Handle melder checkbox toggling
    document.querySelectorAll(".melder-checkbox").forEach((checkbox) => {
        checkbox.addEventListener("change", async (e) => {
            const groupName = e.target.getAttribute("data-group");
            const melderId = parseInt(e.target.getAttribute("data-melder"), 10);
            const checked = e.target.checked;

            if (!selectedQuartal) {
                alert("Bitte wählen Sie zuerst das Quartal aus!");
                return;
            }

            const updatedGruppen = anlageData.meldergruppen.map((gruppe) => {
                if (gruppe.name === groupName) {
                    return {
                        ...gruppe,
                        meldepunkte: gruppe.meldepunkte.map((melder) => {
                            if (melder.id === melderId) {
                                return {
                                    ...melder,
                                    geprüft: checked,
                                    quartal: selectedQuartal,
                                    jahre: checked
                                        ? [...melder.jahre, selectedYear]
                                        : melder.jahre.filter(year => year !== selectedYear)
                                };
                            }
                            return melder;
                        })
                    };
                }
                return gruppe;
            });

            // Update in Firestore
            await setDoc(doc(db, "anlagen", anlageId), { ...anlageData, meldergruppen: updatedGruppen });
            alert("Status wurde aktualisiert.");
        });
    });
}
