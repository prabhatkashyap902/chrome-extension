function getRandomColor() {
  const letters = "0123456789ABCDEF";
  let color = "#";
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

function App() {
  const changeBg = async () => {
    const color = getRandomColor();
    // Inject a script into the current page to change background color
    if (window.chrome && chrome.tabs) {
      const [tab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: (color) => {
          document.body.style.background = color;
        },
        args: [color],
      });
    }
  };

  return (
    <div style={{ minWidth: 220, minHeight: 100, padding: 20 }}>
      <button onClick={changeBg}>Change Background Color</button>
    </div>
  );
}

export default App;
