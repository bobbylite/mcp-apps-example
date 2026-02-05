// src/mcp-app.ts
import { App } from "@modelcontextprotocol/ext-apps";
import {
  lirrProjects,
  type LIRRProject,
  getRandomWoodyQuote,
  searchProjects,
  calculateWoodyEstimate,
  estimationFactors,
} from "./lirr-projects";
import woodyLogoUrl from "./assets/woody-logo.png";
import {
  login,
  logout,
  isAuthenticated,
  hasAuthCallback,
  handleCallback,
  getUser,
} from "./auth";

// Auth DOM elements
const loginScreen = document.getElementById("loginScreen") as HTMLDivElement;
const loadingScreen = document.getElementById("loadingScreen") as HTMLDivElement;
const appContainer = document.getElementById("appContainer") as HTMLDivElement;
const loginBtn = document.getElementById("loginBtn") as HTMLButtonElement;
const logoutBtn = document.getElementById("logoutBtn") as HTMLButtonElement;
const userNameEl = document.getElementById("userName") as HTMLDivElement;
const userEmailEl = document.getElementById("userEmail") as HTMLDivElement;
const loginWoodyLogo = document.getElementById("loginWoodyLogo") as HTMLImageElement;

// DOM elements
const woodyQuoteEl = document.getElementById("woodyQuote") as HTMLDivElement;
const searchInput = document.getElementById("searchInput") as HTMLInputElement;
const projectsList = document.getElementById("projectsList") as HTMLDivElement;
const estimateSection = document.getElementById(
  "estimateSection"
) as HTMLDivElement;
const estimateTitle = document.getElementById(
  "estimateTitle"
) as HTMLSpanElement;
const confidenceBadge = document.getElementById(
  "confidenceBadge"
) as HTMLSpanElement;
const lowEstimate = document.getElementById("lowEstimate") as HTMLDivElement;
const highEstimate = document.getElementById("highEstimate") as HTMLDivElement;
const woodyGuess = document.getElementById("woodyGuess") as HTMLDivElement;
const detailCategory = document.getElementById(
  "detailCategory"
) as HTMLSpanElement;
const detailLocation = document.getElementById(
  "detailLocation"
) as HTMLSpanElement;
const detailTimeline = document.getElementById(
  "detailTimeline"
) as HTMLSpanElement;
const detailEstimatedCost = document.getElementById(
  "detailEstimatedCost"
) as HTMLSpanElement;
const detailActualCost = document.getElementById(
  "detailActualCost"
) as HTMLSpanElement;
const detailVariance = document.getElementById(
  "detailVariance"
) as HTMLSpanElement;
const actualCostRow = document.getElementById("actualCostRow") as HTMLDivElement;
const varianceRow = document.getElementById("varianceRow") as HTMLDivElement;
const componentTags = document.getElementById("componentTags") as HTMLDivElement;
const newQuoteBtn = document.getElementById("newQuoteBtn") as HTMLButtonElement;
const selectBtn = document.getElementById("selectBtn") as HTMLButtonElement;
const toast = document.getElementById("toast") as HTMLDivElement;
const filterBtns = document.querySelectorAll(".filter-btn");

// Initialize the MCP App
const app = new App({ name: "Woody's Wild Guess", version: "1.0.0" });

// Current state
let selectedProject: LIRRProject | null = null;
let currentFilter = "all";
let currentEstimate: ReturnType<typeof calculateWoodyEstimate> | null = null;

// Helper functions
function formatCurrency(millions: number): string {
  if (millions >= 1000) {
    return `$${(millions / 1000).toFixed(1)}B`;
  }
  return `$${millions.toFixed(0)}M`;
}

function getStatusClass(status: LIRRProject["status"]): string {
  const statusMap: Record<LIRRProject["status"], string> = {
    completed: "status-completed",
    "in-progress": "status-in-progress",
    planned: "status-planned",
    "under-study": "status-under-study",
  };
  return statusMap[status] || "status-planned";
}

function getStatusLabel(status: LIRRProject["status"]): string {
  const labelMap: Record<LIRRProject["status"], string> = {
    completed: "Completed",
    "in-progress": "In Progress",
    planned: "Planned",
    "under-study": "Under Study",
  };
  return labelMap[status] || status;
}

function getRiskLevel(
  project: LIRRProject
): keyof typeof estimationFactors.riskFactors {
  // Determine risk based on project characteristics
  if (project.status === "completed" && project.actualCost) {
    return "low"; // Historical data available
  }
  if (project.status === "in-progress") {
    return "medium";
  }
  if (project.status === "under-study") {
    return "veryHigh";
  }
  // For planned projects, base risk on category
  const highRiskCategories = ["Expansion", "Electrification"];
  if (highRiskCategories.includes(project.category)) {
    return "high";
  }
  return "medium";
}

function getConfidenceClass(confidence: string): string {
  const classMap: Record<string, string> = {
    "High Confidence": "confidence-high",
    "Moderate Confidence": "confidence-moderate",
    "Low Confidence": "confidence-low",
    Speculative: "confidence-speculative",
  };
  return classMap[confidence] || "confidence-moderate";
}

function renderProjects(projects: LIRRProject[]) {
  if (projects.length === 0) {
    projectsList.innerHTML = `<div class="no-results">No projects found. Try a different search term.</div>`;
    return;
  }

  projectsList.innerHTML = projects
    .map(
      (project) => `
    <div class="project-item" data-id="${project.id}">
      <div class="project-name">${project.name}</div>
      <div class="project-meta">
        ${project.category} | ${project.location}
        <span class="project-status ${getStatusClass(project.status)}">${getStatusLabel(project.status)}</span>
      </div>
    </div>
  `
    )
    .join("");

  // Add click listeners to project items
  projectsList.querySelectorAll(".project-item").forEach((item) => {
    item.addEventListener("click", () => {
      const projectId = item.getAttribute("data-id");
      const project = lirrProjects.find((p) => p.id === projectId);
      if (project) {
        selectProject(project);
      }
    });
  });
}

function selectProject(project: LIRRProject) {
  selectedProject = project;

  // Update selection UI
  projectsList.querySelectorAll(".project-item").forEach((item) => {
    item.classList.remove("selected");
    if (item.getAttribute("data-id") === project.id) {
      item.classList.add("selected");
    }
  });

  // Calculate estimate
  const riskLevel = getRiskLevel(project);
  currentEstimate = calculateWoodyEstimate(
    project.estimatedCost,
    project.category,
    riskLevel
  );

  // Update estimate section
  estimateTitle.textContent = project.name;
  confidenceBadge.textContent = currentEstimate.confidence;
  confidenceBadge.className = `confidence-badge ${getConfidenceClass(currentEstimate.confidence)}`;

  lowEstimate.textContent = formatCurrency(currentEstimate.lowEstimate);
  highEstimate.textContent = formatCurrency(currentEstimate.highEstimate);
  woodyGuess.textContent = formatCurrency(currentEstimate.woodyGuess);

  // Update details
  detailCategory.textContent = project.category;
  detailLocation.textContent = project.location;

  const timeline = project.completionYear
    ? `${project.startYear} - ${project.completionYear}`
    : `${project.startYear} - TBD`;
  detailTimeline.textContent = timeline;

  // Always show original estimate
  detailEstimatedCost.textContent = formatCurrency(project.estimatedCost);

  // Show actual cost and variance if available
  if (project.actualCost) {
    actualCostRow.style.display = "";
    varianceRow.style.display = "";
    detailActualCost.textContent = formatCurrency(project.actualCost);

    const variance = ((project.actualCost - project.estimatedCost) / project.estimatedCost) * 100;
    const varianceSign = variance >= 0 ? "+" : "";
    const varianceColor = variance > 0 ? "#991b1b" : "#065f46";
    detailVariance.textContent = `${varianceSign}${variance.toFixed(1)}%`;
    detailVariance.style.color = varianceColor;
  } else {
    actualCostRow.style.display = "none";
    varianceRow.style.display = "none";
  }

  // Update components
  componentTags.innerHTML = project.keyComponents
    .map((component) => `<span class="component-tag">${component}</span>`)
    .join("");

  // Show estimate section
  estimateSection.classList.add("show");

  // Update Woody's quote
  woodyQuoteEl.textContent = getRandomWoodyQuote();
}

function filterProjects(): LIRRProject[] {
  let filtered = lirrProjects;

  // Apply status filter
  if (currentFilter !== "all") {
    filtered = filtered.filter((p) => p.status === currentFilter);
  }

  // Apply search filter
  const searchTerm = searchInput.value.trim();
  if (searchTerm) {
    filtered = searchProjects(searchTerm).filter((p) =>
      currentFilter === "all" ? true : p.status === currentFilter
    );
  }

  return filtered;
}

function showToast(message: string) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => {
    toast.classList.remove("show");
  }, 2000);
}

// Event listeners
searchInput.addEventListener("input", () => {
  const filtered = filterProjects();
  renderProjects(filtered);
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentFilter = btn.getAttribute("data-filter") || "all";
    const filtered = filterProjects();
    renderProjects(filtered);
  });
});

newQuoteBtn.addEventListener("click", () => {
  woodyQuoteEl.textContent = getRandomWoodyQuote();

  // If a project is selected, recalculate the estimate with new random factor
  if (selectedProject) {
    selectProject(selectedProject);
  }
});

selectBtn.addEventListener("click", async () => {
  if (!selectedProject || !currentEstimate) {
    showToast("Please select a project first!");
    return;
  }

  // Build the estimate message
  const actualCostSection = selectedProject.actualCost
    ? `
MTA Cost Data:
- Original Estimate: ${formatCurrency(selectedProject.estimatedCost)}
- Actual Final Cost: ${formatCurrency(selectedProject.actualCost)}
- Cost Variance: ${((selectedProject.actualCost - selectedProject.estimatedCost) / selectedProject.estimatedCost * 100).toFixed(1)}% ${selectedProject.actualCost > selectedProject.estimatedCost ? "over budget" : "under budget"}`
    : `
MTA Official Estimate: ${formatCurrency(selectedProject.estimatedCost)}`;

  const message = `
LIRR Capital Project Estimate - ${selectedProject.name}

Project Details:
- Category: ${selectedProject.category}
- Location: ${selectedProject.location}
- Status: ${getStatusLabel(selectedProject.status)}
- Timeline: ${selectedProject.startYear}${selectedProject.completionYear ? ` - ${selectedProject.completionYear}` : " - TBD"}

Woody's Estimate:
- Low Estimate: ${formatCurrency(currentEstimate.lowEstimate)}
- High Estimate: ${formatCurrency(currentEstimate.highEstimate)}
- Woody's Wild Guess: ${formatCurrency(currentEstimate.woodyGuess)}
- Confidence: ${currentEstimate.confidence}
${actualCostSection}

Key Components:
${selectedProject.keyComponents.map((c) => `- ${c}`).join("\n")}

Description:
${selectedProject.description}
`.trim();

  // Send the estimate back to the conversation
  await app.updateModelContext({
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  });

  showToast("Estimate sent!");

  // Log the selection
  await app.sendLog({
    level: "info",
    data: `User requested estimate for: ${selectedProject.name} - Woody's Guess: ${formatCurrency(currentEstimate.woodyGuess)}`,
  });
});

// Show/hide screens
function showLoginScreen() {
  loginScreen.classList.remove("hidden");
  loadingScreen.classList.add("hidden");
  appContainer.classList.add("hidden");
}

function showLoadingScreen() {
  loginScreen.classList.add("hidden");
  loadingScreen.classList.remove("hidden");
  appContainer.classList.add("hidden");
}

function showAppScreen() {
  loginScreen.classList.add("hidden");
  loadingScreen.classList.add("hidden");
  appContainer.classList.remove("hidden");
}

// Update user info display
function updateUserDisplay() {
  const user = getUser();
  if (user) {
    userNameEl.textContent = user.name || user.given_name || "User";
    userEmailEl.textContent = user.email || "";
  }
}

// Initialize the main app functionality
async function initializeMainApp() {
  // Set the Woody logo src to the imported asset
  const woodyLogoImg = document.querySelector(
    '#appContainer img[alt="Woody\'s Wild Guess Logo"]'
  ) as HTMLImageElement;
  if (woodyLogoImg) {
    woodyLogoImg.src = woodyLogoUrl;
  }

  // Update user display
  updateUserDisplay();

  // Try to connect to the MCP host (may fail in standalone browser mode)
  try {
    await app.connect();
    console.log("Woody's Wild Guess app connected!");

    // Handle initial tool result from the server (only when connected to MCP)
    app.ontoolresult = (result) => {
      console.log("Received tool result:", result);

      // Check if there's a project query in the initial request
      const text = result.content?.find((c) => c.type === "text")?.text;
      if (text) {
        // Try to find a matching project from the query
        const query = text.toLowerCase();
        const matchingProjects = searchProjects(query);
        if (matchingProjects.length > 0) {
          // Auto-select the first matching project
          selectProject(matchingProjects[0]);
          searchInput.value = query;
          renderProjects(matchingProjects);
        }
      }
    };
  } catch (err) {
    console.log("Running in standalone browser mode (no MCP host)");
  }

  // Set initial Woody quote
  woodyQuoteEl.textContent = getRandomWoodyQuote();

  // Render all projects initially
  renderProjects(lirrProjects);

  // Show the app
  showAppScreen();
}

// Initialize auth flow
async function initialize() {
  // Set Woody logo on login screen
  if (loginWoodyLogo) {
    loginWoodyLogo.src = woodyLogoUrl;
  }

  // Wire up login button
  loginBtn.addEventListener("click", () => {
    loginBtn.disabled = true;
    loginBtn.textContent = "Redirecting...";
    login();
  });

  // Wire up logout button
  logoutBtn.addEventListener("click", () => {
    logout();
  });

  // Check if this is an auth callback
  if (hasAuthCallback()) {
    showLoadingScreen();
    const success = await handleCallback();
    if (success) {
      await initializeMainApp();
    } else {
      showLoginScreen();
    }
    return;
  }

  // Check if already authenticated
  if (isAuthenticated()) {
    showLoadingScreen();
    await initializeMainApp();
    return;
  }

  // Show login screen
  showLoginScreen();
}

initialize().catch((err) => {
  console.error("Failed to initialize app:", err);
  showLoginScreen();
});
