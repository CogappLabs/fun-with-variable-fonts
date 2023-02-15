let midi = null; // global MIDIAccess object
// If dark mode is true, restrict lightness values
let darkMode = true;
let animateMode = false;

let animateInterval = null;

const textElem = document.getElementById("text");

const shared = {
  params: [
    {
      property: "--size",
      setter: (value) => `${map(value, [0, 127], [24, 128])}px`,
      locked: false,
      ccNumber: 5,
    },
    {
      property: "--h",
      setter: (value) => `${map(value, [0, 127], [0, 360])}`,
      locked: false,
      ccNumber: 6,
    },
    {
      property: "--s",
      setter: (value) => `${map(value, [0, 127], [0, 100])}%`,
      locked: false,
      ccNumber: 7,
    },
    {
      property: "--l",
      setter: (value) =>
        // Restrict lightness to prevent text disappearing into background
        `${map(value, [0, 127], [darkMode ? 50 : 0, darkMode ? 100 : 50])}%`,
      locked: false,
      ccNumber: 8,
    },
    {
      action: (status) => {
        if (status.startsWith("9")) {
          randomiseParameters(true);
          updateComputedStyles(textElem);
        }
      },
      ccNumber: 40,
    },
    {
      action: (status) => {
        // Note-on event
        if (status.startsWith("9")) {
          toggleAnimateMode();
        }
      },
      ccNumber: 41,
    },
    {
      action: (status) => {
        // Note-on event
        if (status.startsWith("9")) {
          toggleDarkMode();
        }
      },
      ccNumber: 42,
    },
  ],
};

// Font-specific actions
const recursive = {
  fontFamily: "'Recursive', monospace",
  params: [
    {
      property: "--mono",
      setter: (value) => `"MONO" ${map(value, [0, 127], [0, 1])}`,
      locked: false,
      ccNumber: 1,
    },
    {
      property: "--casl",
      setter: (value) => `"CASL" ${map(value, [0, 127], [0, 1])}`,
      locked: false,
      ccNumber: 2,
    },
    {
      property: "--wght",
      setter: (value) => `"wght" ${map(value, [0, 127], [300, 1000])}`,
      locked: false,
      ccNumber: 3,
    },
    {
      property: "--slnt",
      setter: (value) => `"slnt" ${map(value, [0, 127], [-15, 0])}`,
      locked: false,
      ccNumber: 4,
    },
  ],
};

/**
 * Map a value from one range to another
 *
 * @method map
 * @param {Number} [value] Value to map
 * @param {Array} [oldRange] Range to map from
 * @param {Array} [newRange] Range to map to
 * @return {Number} Mapped value
 */
function map(value, oldRange, newRange) {
  var newValue =
    ((value - oldRange[0]) * (newRange[1] - newRange[0])) /
      (oldRange[1] - oldRange[0]) +
    newRange[0];
  return Math.min(Math.max(newValue, newRange[0]), newRange[1]);
}

const updateComputedStyles = (element) => {
  const compStyles = window.getComputedStyle(element);
  document.querySelector(
    ".js-output"
  ).innerHTML = `color: ${compStyles.getPropertyValue("color")};
font-family: ${compStyles.getPropertyValue("font-family")};
font-size: ${compStyles.getPropertyValue("font-size")};
font-variation-settings: ${compStyles.getPropertyValue(
    "font-variation-settings"
  )};
`;
  document.body.style.setProperty(
    "--accent-color",
    compStyles.getPropertyValue("color")
  );
};

function randomiseParameters(once = true, transitionTime = 300) {
  const combinedParams = [
    ...shared.params,
    ...recursive.params,
  ];

  textElem.style.setProperty(
    "transition",
    `color ${transitionTime * 0.001}s ease, font-size ${
      transitionTime * 0.001
    }s ease, font-variation-settings ${transitionTime * 0.001}s ease`
  );

  for (const param in combinedParams) {
    if (!combinedParams[param].locked && 'property' in combinedParams[param]) {
      const newValue = Math.random() * 127;
      textElem.style.setProperty(
        combinedParams[param].property,
        combinedParams[param].setter(Math.random() * 127)
      );
      // Update the associated input
      const rangeInput = document.querySelector(
        `input[type="range"][data-param="${param}"]`
      );
      if (rangeInput) {
        rangeInput.value = newValue;
      }
    }
  }

  // If running once, remove the transition property immediately after it's
  // finished so knobs respond instantly
  if (once) {
    setTimeout(() => {
      textElem.style.setProperty("transition", "none");
    }, transitionTime);
  }

  updateComputedStyles(textElem);
}

function toggleAnimateMode() {
  animateMode = !animateMode;

  if (animateMode) {
    animateInterval = setInterval(randomiseParameters, 2000, false, 700);
  } else {
    clearInterval(animateInterval);
    textElem.style.setProperty("transition", "none");
  }
}

function toggleDarkMode() {
  darkMode = !darkMode;
  document.body.style.setProperty(
    "--background-color",
    darkMode ? "#000" : "#fff"
  );
  document.body.style.setProperty("--text-color", darkMode ? "#fff" : "#000");
}

function updateCustomProperty(status, ccNumber, value) {
  
  const combinedParams = [
    ...shared.params,
    ...recursive.params,
  ];

  // There may be a more performant way of doing this check
  const matchingParams = combinedParams.filter((param) => param.ccNumber === ccNumber)

  if (matchingParams.length > 0) {
    // A single CC number could control multiple parameters
    matchingParams.forEach((param) => {
      if ('action' in param) {
        return param.action(status);
      }
      if (!param.locked) {
        textElem.style.setProperty(
          param.property,
          param.setter(value)
        );

        // Update the associated input
        const rangeInput = document.querySelector(
          `input[type="range"][data-param="${ccNumber}"]`
        );
        if (rangeInput) {
          rangeInput.value = value;
        }
      }
    })
  }

  updateComputedStyles(textElem);

}

function onMIDIMessage(event) {
  let str = `MIDI message received at timestamp ${event.timeStamp}[${event.data.length} bytes]: `;
  for (const character of event.data) {
    str += `0x${character.toString(16)}`;
  }
  console.log(str);
  console.log(`CC${event.data[1]} value ${event.data[2]}`);
  updateCustomProperty(
    event.data[0].toString(16),
    event.data[1],
    event.data[2]
  );
}

function startLoggingMIDIInput(midiAccess, indexOfPort) {
  midiAccess.inputs.forEach((entry) => {
    entry.onmidimessage = onMIDIMessage;
  });
}

function onMIDISuccess(midiAccess) {
  console.log("MIDI ready!");
  midi = midiAccess; // store in the global (in real usage, would probably keep in an object instance)
  startLoggingMIDIInput(midi);
}

function onMIDIFailure(msg) {
  console.error(`Failed to get MIDI access - ${msg}`);
}

navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);

updateComputedStyles(textElem);

const sliders = document.querySelectorAll('input[type="range"]');

sliders.forEach((input) =>
  input.addEventListener("change", (e) => {
    const combinedParams = {
      ...shared.params,
      ...recursive.params,
    };

    const value = e.currentTarget.value;
    textElem.style.setProperty(
      combinedParams[e.currentTarget.dataset.param].property,
      combinedParams[e.currentTarget.dataset.param].setter(value)
    );
    combinedParams[e.currentTarget.dataset.param].setter(value);
    updateComputedStyles(textElem);
  })
);

const lockCheckboxes = document.querySelectorAll('input[type="checkbox"]');

lockCheckboxes.forEach((input) =>
  input.addEventListener("change", (e) => {
    const combinedParams = {
      ...shared.params,
      ...recursive.params,
    };

    const checked = e.currentTarget.checked;
    combinedParams[e.currentTarget.dataset.param].locked = checked;
  })
);

const randomiseButton = document.querySelector("#randomise");

randomiseButton.addEventListener("click", randomiseParameters);

const toggleAnimationButton = document.querySelector("#toggle-animation");

toggleAnimationButton.addEventListener("click", (e) => {
  toggleAnimateMode();
  e.currentTarget.innerHTML = `${
    animateMode == true ? "Stop" : "Start"
  } animation`;
});

const toggleDarkModeButton = document.querySelector("#toggle-dark-mode");

toggleDarkModeButton.addEventListener("click", (e) => {
  toggleDarkMode();
  e.currentTarget.innerHTML = `Dark mode ${darkMode == true ? "off" : "on"}`;
});
