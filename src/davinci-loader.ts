// Load the DaVinci SDK and expose it globally
// The SDK is a UMD module that sets window.davinci

// Import the SDK code as a raw string and eval it to set the global
import sdkCode from "./davinci-sdk.js?raw";

// Execute the SDK in global scope
(function() {
  const script = document.createElement("script");
  script.textContent = sdkCode;
  document.head.appendChild(script);
})();

// Export a function to verify it loaded
export function isDaVinciLoaded(): boolean {
  return typeof (window as any).davinci !== "undefined";
}
