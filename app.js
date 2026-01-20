const STORAGE_KEY = "trip-expense-splitter-state";

const defaultState = {
  trips: [],
  activeTripId: null
};

const state = loadState() || defaultState;

const elements = {
  tripList: document.getElementById("trip-list"),
  tripForm: document.getElementById("trip-form"),
  tripName: document.getElementById("trip-name"),
  activeTripLabel: document.getElementById("active-trip-label"),
  peopleList: document.getElementById("people-list"),
  personForm: document.getElementById("person-form"),
  personName: document.getElementById("person-name"),
  expenseForm: document.getElementById("expense-form"),
  expenseName: document.getElementById("expense-name"),
  payerSelect: document.getElementById("payer-select"),
  expenseAmount: document.getElementById("expense-amount"),
  splitMode: document.getElementById("split-mode"),
  participantsList: document.getElementById("participants-list"),
  expenseList: document.getElementById("expense-list"),
  balancesTable: document.getElementById("balances-table"),
  settleList: document.getElementById("settle-list"),
  resetTripButton: document.getElementById("reset-trip"),
  clearAllButton: document.getElementById("clear-data")
};

if (state.trips.length && !state.activeTripId) {
  state.activeTripId = state.trips[0].id;
}

bindEvents();
render();

function bindEvents() {
  elements.tripForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = elements.tripName.value.trim();
    if (!name) {
      return;
    }
    const trip = {
      id: uid(),
      name,
      people: [],
      expenses: []
    };
    state.trips.push(trip);
    state.activeTripId = trip.id;
    elements.tripName.value = "";
    persist();
    render();
  });

  elements.tripList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    const action = button.dataset.action;
    const tripId = button.dataset.id;
    if (!action || !tripId) {
      return;
    }
    if (action === "select") {
      state.activeTripId = tripId;
      persist();
      render();
    }
    if (action === "rename") {
      const trip = findTrip(tripId);
      if (!trip) {
        return;
      }
      const nextName = window.prompt("Rename trip", trip.name);
      if (nextName && nextName.trim()) {
        trip.name = nextName.trim();
        persist();
        render();
      }
    }
    if (action === "delete") {
      const trip = findTrip(tripId);
      if (!trip) {
        return;
      }
      const confirmed = window.confirm("Delete this trip and all its data?");
      if (!confirmed) {
        return;
      }
      state.trips = state.trips.filter((item) => item.id !== tripId);
      if (state.activeTripId === tripId) {
        state.activeTripId = state.trips.length ? state.trips[0].id : null;
      }
      persist();
      render();
    }
  });

  elements.resetTripButton.addEventListener("click", () => {
    const trip = getActiveTrip();
    if (!trip || trip.expenses.length === 0) {
      return;
    }
    const confirmed = window.confirm("Clear all expenses for this trip?");
    if (!confirmed) {
      return;
    }
    trip.expenses = [];
    persist();
    render();
  });

  elements.clearAllButton.addEventListener("click", () => {
    const confirmed = window.confirm("Clear all trips and stored data?");
    if (!confirmed) {
      return;
    }
    state.trips = [];
    state.activeTripId = null;
    localStorage.removeItem(STORAGE_KEY);
    render();
  });

  elements.personForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const trip = getActiveTrip();
    if (!trip) {
      return;
    }
    const name = elements.personName.value.trim();
    if (!name) {
      return;
    }
    trip.people.push({
      id: uid(),
      name,
      weight: 1
    });
    elements.personName.value = "";
    persist();
    render();
  });

  elements.peopleList.addEventListener("input", (event) => {
    const field = event.target.dataset.field;
    if (!field) {
      return;
    }
    const personId = event.target.dataset.id;
    const trip = getActiveTrip();
    if (!trip) {
      return;
    }
    const person = trip.people.find((item) => item.id === personId);
    if (!person) {
      return;
    }
    if (field === "name") {
      const nextName = event.target.value.trim();
      if (!nextName) {
        return;
      }
      person.name = nextName;
    }
    if (field === "weight") {
      const nextWeight = parseFloat(event.target.value);
      const normalized = Number.isFinite(nextWeight) && nextWeight > 0 ? nextWeight : 1;
      person.weight = normalized;
      event.target.value = normalized;
    }
    persist();
    renderResults();
  });

  elements.peopleList.addEventListener("blur", (event) => {
    const field = event.target.dataset.field;
    if (field !== "name") {
      return;
    }
    const trip = getActiveTrip();
    if (!trip) {
      return;
    }
    const personId = event.target.dataset.id;
    const person = trip.people.find((item) => item.id === personId);
    if (!person) {
      return;
    }
    const nextName = event.target.value.trim();
    if (!nextName) {
      event.target.value = person.name;
    }
  }, true);

  elements.peopleList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    const personId = button.dataset.id;
    const trip = getActiveTrip();
    if (!trip || !personId) {
      return;
    }
    trip.people = trip.people.filter((person) => person.id !== personId);
    trip.expenses = trip.expenses
      .filter((expense) => expense.payerId !== personId)
      .map((expense) => ({
        ...expense,
        participants: expense.participants.filter((id) => id !== personId)
      }))
      .filter((expense) => expense.participants.length > 0);
    persist();
    render();
  });

  elements.expenseForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const trip = getActiveTrip();
    if (!trip) {
      return;
    }
    const name = elements.expenseName.value.trim();
    const payerId = elements.payerSelect.value;
    const amount = parseFloat(elements.expenseAmount.value);
    const mode = elements.splitMode.value;
    const participants = Array.from(
      elements.participantsList.querySelectorAll("input[type=checkbox]:checked")
    ).map((input) => input.value);

    if (!name) {
      window.alert("Enter an expense name.");
      return;
    }

    if (!payerId || !Number.isFinite(amount) || amount <= 0) {
      window.alert("Enter a valid payer and amount.");
      return;
    }

    if (participants.length < 2) {
      window.alert("Select at least two participants.");
      return;
    }

    trip.expenses.push({
      id: uid(),
      name,
      payerId,
      amount,
      mode,
      participants
    });

    elements.expenseName.value = "";
    elements.expenseAmount.value = "";
    persist();
    render();
  });

  elements.expenseForm.addEventListener("input", updateExpenseValidation);
  elements.expenseForm.addEventListener("change", updateExpenseValidation);

  elements.expenseList.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) {
      return;
    }
    const expenseId = button.dataset.id;
    const trip = getActiveTrip();
    if (!trip || !expenseId) {
      return;
    }
    trip.expenses = trip.expenses.filter((expense) => expense.id !== expenseId);
    persist();
    render();
  });
}

function render() {
  renderTrips();
  renderPeople();
  renderExpenses();
  renderResults();
}

function renderTrips() {
  elements.tripList.innerHTML = "";
  if (!state.trips.length) {
    elements.tripList.innerHTML = "<li class=\"muted\">No trips yet.</li>";
  }
  state.trips.forEach((trip) => {
    const item = document.createElement("li");
    item.className = "list-item" + (trip.id === state.activeTripId ? " active" : "");
    item.innerHTML = `
      <div>
        <div class="title">${escapeHtml(trip.name)}</div>
        <div class="muted">${trip.people.length} people - ${trip.expenses.length} expenses</div>
      </div>
      <div class="row">
        <button class="secondary" data-action="select" data-id="${trip.id}">Open</button>
        <button class="ghost" data-action="rename" data-id="${trip.id}">Rename</button>
        <button class="ghost" data-action="delete" data-id="${trip.id}">Delete</button>
      </div>
    `;
    elements.tripList.appendChild(item);
  });

  const activeTrip = getActiveTrip();
  elements.activeTripLabel.textContent = activeTrip ? `Active: ${activeTrip.name}` : "No trip selected";
  elements.resetTripButton.disabled = !activeTrip || activeTrip.expenses.length === 0;
  elements.clearAllButton.disabled = state.trips.length === 0;
}

function renderPeople() {
  const trip = getActiveTrip();
  elements.peopleList.innerHTML = "";

  elements.personForm.querySelector("button").disabled = !trip;
  elements.personName.disabled = !trip;

  if (!trip) {
    elements.peopleList.innerHTML = "<p class=\"muted\">Create or select a trip to add people.</p>";
    return;
  }

  if (!trip.people.length) {
    elements.peopleList.innerHTML = "<p class=\"muted\">No people yet.</p>";
  }

  trip.people.forEach((person) => {
    const row = document.createElement("div");
    row.className = "list-item";
    row.innerHTML = `
      <div class="stack" style="flex:1;">
        <label class="field">
          <span>Name</span>
          <input data-field="name" data-id="${person.id}" value="${escapeHtml(person.name)}">
        </label>
      </div>
      <label class="field">
        <span>Weight</span>
        <input type="number" min="0.1" step="0.1" data-field="weight" data-id="${person.id}" value="${person.weight}">
      </label>
      <button class="ghost" data-id="${person.id}">Remove</button>
    `;
    elements.peopleList.appendChild(row);
  });
}

function renderExpenses() {
  const trip = getActiveTrip();
  elements.expenseList.innerHTML = "";
  elements.participantsList.innerHTML = "";

  const formDisabled = !trip || trip.people.length === 0;
  elements.expenseForm.querySelector("button").disabled = formDisabled;
  elements.expenseName.disabled = formDisabled;
  elements.payerSelect.disabled = formDisabled;
  elements.expenseAmount.disabled = formDisabled;
  elements.splitMode.disabled = formDisabled;

  if (!trip) {
    elements.expenseName.value = "";
    elements.payerSelect.innerHTML = "";
    elements.participantsList.innerHTML = "<p class=\"muted\">Select a trip first.</p>";
    return;
  }

  if (!trip.people.length) {
    elements.expenseName.value = "";
    elements.payerSelect.innerHTML = "";
    elements.participantsList.innerHTML = "<p class=\"muted\">Add people to record expenses.</p>";
  }

  elements.payerSelect.innerHTML = trip.people
    .map((person) => `<option value="${person.id}">${escapeHtml(person.name)}</option>`)
    .join("");

  trip.people.forEach((person) => {
    const label = document.createElement("label");
    label.className = "row";
    label.innerHTML = `
      <input type="checkbox" value="${person.id}" checked>
      <span>${escapeHtml(person.name)}</span>
    `;
    elements.participantsList.appendChild(label);
  });

  if (!trip.expenses.length) {
    elements.expenseList.innerHTML = "<p class=\"muted\">No expenses recorded.</p>";
  }

  trip.expenses.forEach((expense) => {
    const payer = trip.people.find((person) => person.id === expense.payerId);
    const participants = expense.participants
      .map((id) => trip.people.find((person) => person.id === id))
      .filter(Boolean)
      .map((person) => person.name)
      .join(", ");

    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <div class="title">${escapeHtml(expense.name)}</div>
        <div class="muted">${payer ? escapeHtml(payer.name) : "Unknown"} paid $${expense.amount.toFixed(2)} - ${expense.mode} split - ${escapeHtml(participants)}</div>
      </div>
      <button class="ghost" data-id="${expense.id}">Delete</button>
    `;
    elements.expenseList.appendChild(item);
  });

  updateExpenseValidation();
}

function renderResults() {
  const trip = getActiveTrip();
  elements.balancesTable.innerHTML = "";
  elements.settleList.innerHTML = "";

  if (!trip || !trip.people.length) {
    elements.balancesTable.innerHTML = "<tr><td class=\"muted\">Add people and expenses to see balances.</td></tr>";
    return;
  }

  const balances = calculateBalances(trip);
  const rows = [
    "<tr><th>Person</th><th>Balance</th></tr>",
    ...trip.people.map((person) => {
      const balance = balances.get(person.id) || 0;
      const label = balance >= 0 ? "owed" : "owes";
      return `<tr><td>${escapeHtml(person.name)}</td><td>${formatMoney(balance)} <span class=\"badge\">${label}</span></td></tr>`;
    })
  ];
  elements.balancesTable.innerHTML = rows.join("");

  const settlements = settleBalances(trip, balances);
  if (!settlements.length) {
    elements.settleList.innerHTML = "<p class=\"muted\">Everyone is settled up.</p>";
    return;
  }

  settlements.forEach((settlement) => {
    const card = document.createElement("div");
    card.className = "settle-card";
    card.textContent = `${settlement.from} pays ${settlement.to} ${formatMoney(settlement.amount)}`;
    elements.settleList.appendChild(card);
  });
}

function getExpenseValidation(trip) {
  if (!trip) {
    return { valid: false, message: "Select a trip first." };
  }
  if (!trip.people.length) {
    return { valid: false, message: "Add people to record expenses." };
  }
  const name = elements.expenseName.value.trim();
  if (!name) {
    return { valid: false, message: "Enter an expense name." };
  }
  const payerId = elements.payerSelect.value;
  const amount = parseFloat(elements.expenseAmount.value);
  const participants = Array.from(
    elements.participantsList.querySelectorAll("input[type=checkbox]:checked")
  ).map((input) => input.value);

  if (!payerId || !trip.people.some((person) => person.id === payerId)) {
    return { valid: false, message: "Select a payer." };
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { valid: false, message: "Enter a positive amount." };
  }
  if (participants.length < 2) {
    return { valid: false, message: "Select at least two participants." };
  }

  return { valid: true, message: "" };
}

function updateExpenseValidation() {
  const button = elements.expenseForm.querySelector("button");
  const validation = getExpenseValidation(getActiveTrip());
  button.disabled = !validation.valid;
  button.title = validation.message;
}

function calculateBalances(trip) {
  const balances = new Map(trip.people.map((person) => [person.id, 0]));

  trip.expenses.forEach((expense) => {
    const amountCents = toCents(expense.amount);
    const payerBalance = balances.get(expense.payerId) || 0;
    balances.set(expense.payerId, payerBalance + amountCents);

    const participants = expense.participants
      .map((id) => trip.people.find((person) => person.id === id))
      .filter(Boolean);

    const shares = splitShares(amountCents, participants, expense.mode, expense.payerId);
    participants.forEach((person) => {
      const share = shares.get(person.id) || 0;
      const current = balances.get(person.id) || 0;
      balances.set(person.id, current - share);
    });
  });

  return balances;
}

function splitShares(amountCents, participants, mode, payerId) {
  const shares = new Map();
  const totalCents = Math.round(amountCents);
  if (!participants.length || totalCents <= 0) {
    return shares;
  }

  if (mode !== "weighted") {
    const base = Math.floor(totalCents / participants.length);
    let remainder = totalCents - base * participants.length;
    participants.forEach((person) => {
      shares.set(person.id, base);
    });
    if (remainder > 0) {
      const payer = participants.find((person) => person.id === payerId);
      if (payer) {
        shares.set(payer.id, base + remainder);
        remainder = 0;
      }
    }
    if (remainder > 0) {
      participants.forEach((person) => {
        const bump = remainder > 0 ? 1 : 0;
        shares.set(person.id, (shares.get(person.id) || base) + bump);
        remainder -= bump;
      });
    }
    return shares;
  }

  const weights = participants.map((person) => {
    const weight = Number.isFinite(person.weight) ? person.weight : 1;
    return weight > 0 ? weight : 1;
  });
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  if (totalWeight <= 0) {
    return splitShares(amountCents, participants, "equal");
  }

  const rawShares = weights.map((weight) => (totalCents * weight) / totalWeight);
  const baseShares = rawShares.map((value) => Math.floor(value));
  const baseTotal = baseShares.reduce((sum, value) => sum + value, 0);
  let remainder = totalCents - baseTotal;

  const order = rawShares
    .map((value, index) => ({
      index,
      fraction: value - baseShares[index],
      id: participants[index].id
    }))
    .sort((a, b) => {
      if (b.fraction !== a.fraction) {
        return b.fraction - a.fraction;
      }
      return a.id.localeCompare(b.id);
    });

  if (remainder > 0) {
    const payerIndex = participants.findIndex((person) => person.id === payerId);
    if (payerIndex >= 0) {
      baseShares[payerIndex] += remainder;
      remainder = 0;
    }
  }
  for (const entry of order) {
    if (remainder <= 0) {
      break;
    }
    baseShares[entry.index] += 1;
    remainder -= 1;
  }

  participants.forEach((person, index) => {
    shares.set(person.id, baseShares[index]);
  });

  return shares;
}

function settleBalances(trip, balances) {
  const debtors = [];
  const creditors = [];

  trip.people.forEach((person) => {
    const balance = balances.get(person.id) || 0;
    if (balance < -1) {
      debtors.push({
        name: person.name,
        amount: -balance
      });
    }
    if (balance > 1) {
      creditors.push({
        name: person.name,
        amount: balance
      });
    }
  });

  debtors.sort((a, b) => b.amount - a.amount);
  creditors.sort((a, b) => b.amount - a.amount);

  const settlements = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const payment = Math.min(debtor.amount, creditor.amount);

    if (payment > 0) {
      settlements.push({
        from: debtor.name,
        to: creditor.name,
        amount: payment
      });
    }

    debtor.amount -= payment;
    creditor.amount -= payment;

    if (debtor.amount <= 1) {
      debtorIndex += 1;
    }
    if (creditor.amount <= 1) {
      creditorIndex += 1;
    }
  }

  return settlements;
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn("Unable to save state.", error);
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    return null;
  }
}

function findTrip(tripId) {
  return state.trips.find((trip) => trip.id === tripId);
}

function getActiveTrip() {
  if (!state.activeTripId) {
    return null;
  }
  return findTrip(state.activeTripId);
}

function formatMoney(value) {
  const cents = Math.abs(value);
  if (cents === 0) {
    return "$0.00";
  }
  const sign = value < 0 ? "-" : "";
  return `${sign}$${(cents / 100).toFixed(2)}`;
}

function toCents(value) {
  return Math.round(value * 100);
}

function normalizeState(raw) {
  if (!raw || !Array.isArray(raw.trips)) {
    return null;
  }

  const trips = raw.trips
    .filter((trip) => trip && typeof trip.id === "string" && typeof trip.name === "string")
    .map((trip) => {
      const name = trip.name.trim();
      if (!name) {
        return null;
      }
      const people = Array.isArray(trip.people) ? trip.people : [];
      const normalizedPeople = people
        .filter((person) => person && typeof person.id === "string" && typeof person.name === "string")
        .map((person) => ({
          id: person.id,
          name: person.name.trim(),
          weight: normalizeWeight(person.weight)
        }))
        .filter((person) => person.name);
      const personIds = new Set(normalizedPeople.map((person) => person.id));
      const expenses = Array.isArray(trip.expenses) ? trip.expenses : [];
      const normalizedExpenses = expenses
        .filter((expense) => expense && typeof expense.id === "string" && typeof expense.payerId === "string")
        .filter((expense) => Number.isFinite(expense.amount) && expense.amount > 0)
        .map((expense) => {
          const name = typeof expense.name === "string" ? expense.name.trim() : "Expense";
          const participants = Array.isArray(expense.participants)
            ? expense.participants.filter((id) => personIds.has(id))
            : [];
          return {
            id: expense.id,
            name: name || "Expense",
            payerId: expense.payerId,
            amount: expense.amount,
            mode: expense.mode === "weighted" ? "weighted" : "equal",
            participants
          };
        })
        .filter((expense) => personIds.has(expense.payerId) && expense.participants.length);

      return {
        id: trip.id,
        name,
        people: normalizedPeople,
        expenses: normalizedExpenses
      };
    })
    .filter(Boolean);

  const activeTripId = trips.some((trip) => trip.id === raw.activeTripId) ? raw.activeTripId : null;
  return { trips, activeTripId };
}

function normalizeWeight(value) {
  const weight = Number.isFinite(value) ? value : 1;
  return weight > 0 ? weight : 1;
}

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
