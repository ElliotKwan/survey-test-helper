// ==UserScript==
// @name    Survey Test Helper
// @version 2.18
// @grant   none
// @locale  en
// @description A tool to help with survey testing
// @include /^https?:\/\/.+\.com\/index\.php\/survey\/.*/
// @include /^https?:\/\/.+\.com\/index\.php\/[0-9]{6}.*/
// ==/UserScript==

// Question type-specific classes; in element div.question-container
const QUESTION_CLASSES = {
  "list-radio": 1,
  "numeric": 2,
  "text-short": 3,
  "array-flexible-row": 4,
  "multiple-opt": 5,
  "list-dropdown": 6,
  "numeric-multi": 7
};
const QUESTION_TYPE = {
  radio: 1,
  numericInput: 2,
  shortFreeText: 3,
  array: 4,
  mChoice: 5,
  dropdown: 6,
  multiNumInput: 7
};
const BUTTON_CODES = {
  right: 39,
  left: 37,
  up: 38,
  down: 40,
  spacebar: 32,
  enter: 13,
  esc: 27,
  insert: 45
};
const Q_NUM_CONTEXT = {
  age: 1,
  year: 2,
  zipCode: 3,
  quantity: 4,
  percent: 5,
  yearRef: 6,
  yearAL: 7,
  scale: 8
};
const Q_MC_CONTEXT = {
  two: 2,
  three: 3,
  four: 4,
  five: 5
}
const STH_COMMANDS = [
  "avoid",
  "force"
];
const STH_ERROR = {
  hiddenOptionForced: 1
};
const ACTIVE_NAME = "STH_active";
const ATTEMPTS_NAME = "STH_attempts";
const COMMAND_OBJ_NAME = "STH_commands";
const STH_HIDDEN = "STH_hidden";

let curDate = new Date();
let validAgeYear = curDate.getFullYear() - 18;

let SurveyTestHelper = {
  active: false,
  attempts: 0,
  hidden: false,
  questionCode: null,
  questionType: null,
  commands: null,
  commandsFound: false,
  infoElements: [],
  errorDeactivateOverride: false,
  errorAlertShown: false,
  initialize: function () {
    console.log("Initializing...");

    this.addErrorAlertListener();
    this.questionCode = document.querySelector("span#QNameNumData");
    this.questionCode = this.questionCode ? this.questionCode.dataset.code : "N/A";

    this.questionType = this.getQuestionType();
    this.commands = this.queryCommands();

    this.initStorage();
    this.initUI();

    // Attach handlers
    this.button.onclick = this.buttonActionHandler.bind(this);
    document.onkeydown = this.buttonActionHandler.bind(this);

    document.body.appendChild(this.uiContainer);

    if (this.active) {
      this.enterDummyResponse();
      this.clickNextButton();
    }
  },
  initUI: function () {
    this.uiContainer = document.createElement("div");
    this.alertDisplay = document.createElement("div");
    this.activeCheckbox = document.createElement("input");
    this.button = document.createElement("button");

    let chkBoxLabel = document.createElement("label");

    chkBoxLabel.innerHTML = "Auto Run Toggle:";
    chkBoxLabel.style["background-color"] = "rgba(255,255,255,0.7)";
    chkBoxLabel.style["border-radius"] = "5px";
    chkBoxLabel.style.padding = "0px 3px";
    chkBoxLabel.style.margin = "5px 0px";
    chkBoxLabel.style.cursor = "pointer";
    chkBoxLabel.style.display = "block";
    chkBoxLabel.appendChild(this.activeCheckbox);

    this.alertDisplay.style["font-weight"] = "bold";
    this.alertDisplay.style["background-color"] = "rgba(255,255,255,0.75)";
    this.alertDisplay.style["transition-duration"] = "0.75s";
    this.alertDisplay.ontransitionend = function () {
      this.style.color = "#000000";
    };

    this.activeCheckbox.type = "checkbox";
    this.activeCheckbox.style["margin-left"] = "10px";
    this.activeCheckbox.checked = this.active;
    this.activeCheckbox.onclick = this.setActivity.bind(this);

    this.button.style.display = "block";
    this.button.style.width = "100%";
    this.button.innerHTML = "Input and Continue";
    
    this.uiContainer.appendChild(chkBoxLabel);
    this.uiContainer.appendChild(this.button);
    this.uiContainer.appendChild(this.alertDisplay);

    this.initQuestionInfoDisplay();

    this.uiContainer.style.position = "fixed";
    this.uiContainer.style.padding = "7px";
    this.uiContainer.style.right = "0px";
    this.uiContainer.style.top = "75px";
    this.uiContainer.style["margin-right"] = this.hidden ? "-100%" : marginRightOffset.toString() + "px";
    this.uiContainer.style["transition-duration"] = "0.5s";
    this.uiContainer.style["z-index"] = 2001;
    this.uiContainer.style["background-color"] = "rgba(0,0,0,0.1)";
    this.uiContainer.style["border-radius"] = "10px";
    this.uiContainer.style["text-align"] = "center";
  },
  initQuestionInfoDisplay: function () {
    let qCodeDisplay = document.createElement("div");
    let qContainer = document.querySelector("div.question-container");

    switch (this.questionType) {
      case QUESTION_TYPE.radio:
        this.generateRadioInfoDisplay();
        break;
      case QUESTION_TYPE.array:
        this.generateArrayInfoDisplay();
        break;
      case QUESTION_TYPE.mChoice:
        this.generateMChoiceInfoDisplay();
        break;
      default:
        console.log("Question type for info display not found.");
    }

    qCodeDisplay.innerHTML = this.questionCode;
    qCodeDisplay.style.height = "40px";
    qCodeDisplay.style.display = "inline-block";
    qCodeDisplay.style.color = "floralwhite";
    qCodeDisplay.style.position = "absolute";
    qCodeDisplay.style.top = "-20px";
    qCodeDisplay.style.opacity = this.hidden ? 0 : 0.95;
    qCodeDisplay.style.padding = "10px";
    qCodeDisplay.style["background-color"] = "orange";
    qCodeDisplay.style["border-radius"] = "20px";
    qCodeDisplay.style["font-weight"] = "bold";
    
    qCodeDisplay.dataset.opacity = 0.95;

    if (qContainer) {
      qContainer.appendChild(qCodeDisplay);
      this.infoElements.push(qCodeDisplay);
    } else {
      this.uiContainer.prepend(qCodeDisplay);
      qCodeDisplay.style.position = "relative";
      qCodeDisplay.style.top = "0px";
    }

    // Set generic style settings for each infoDisplay element
    this.infoElements.forEach(e => {
      e.style.color = "white";
      e.style["background-color"] = "orangered";
      e.style["font-weight"] = "bold";
      e.style["transition-duration"] = "0.5s";
    });
  },
  initStorage: function () {
    let activity = localStorage.getItem(ACTIVE_NAME);
    let hiddenVal = localStorage.getItem(STH_HIDDEN);

    let prevQuestion = sessionStorage.getItem("STH_qcode") || "Start";
    let attempts = sessionStorage.getItem(ATTEMPTS_NAME);
    let cmdObjStr = sessionStorage.getItem(COMMAND_OBJ_NAME);

    sessionStorage.setItem("STH_qcode", this.questionCode);
    sessionStorage.setItem("STH_prev_qcode", prevQuestion);

    if (activity) {
      this.active = (activity === "1");
    } else {
      localStorage.setItem(ACTIVE_NAME, "0");
    }

    if (hiddenVal) {
      this.hidden = (hiddenVal === "1");
    } else {
      localStorage.setItem(STH_HIDDEN, "0");
    }

    if (prevQuestion == this.questionCode) {
      this.attempts = Number(attempts);
    } else {
      sessionStorage.removeItem(ATTEMPTS_NAME);
    }

    if (cmdObjStr) {
      if (this.commandsFound) {
        let cmdObj = JSON.parse(cmdObjStr);

        // If the current set of commands is missing something
        // from the stored commands, add them in
        for (const cmd in cmdObj) {
          for (const qCode in cmdObj[cmd]) {
            if (!this.commands[cmd][qCode]) {
              this.commands[cmd][qCode] = cmdObj[cmd][qCode];
            }
          }
        }
        sessionStorage.setItem(COMMAND_OBJ_NAME, JSON.stringify(this.commands));
      } else {
        this.commands = JSON.parse(cmdObjStr);
      }
    } else {
      sessionStorage.setItem(COMMAND_OBJ_NAME, JSON.stringify(this.commands));
    }
  },
  setAlert: function (alertText = "Generic Error Alert.") {
    this.alertDisplay.innerHTML = alertText;
    this.alertDisplay.style.padding = "5px";
    this.alertDisplay.style["margin-top"] = "5px";
    this.alertDisplay.style.border = "1px solid black";
    this.alertDisplay.style.color = "#FF0000";
  },
  clickNextButton: function () {
    let nextBtn = document.querySelector("#movenextbtn") || document.querySelector("#movesubmitbtn");

    if (nextBtn) {
      nextBtn.click();
    } else {
      if (this.active) {
        this.clickPrevButton();
      }
    }
  },
  clickPrevButton: function () {
    let prevBtn = document.querySelector("#moveprevbtn");
    if (prevBtn) {
      prevBtn.click();
    }
  },
  setActivity: function (e) {
    this.active = e.target ? e.target.checked : e;
    this.activeCheckbox.checked = this.active;
    console.log("Activity changed: ", this.active);

    this.setStorageActivity(this.active);
  },
  setStorageActivity: function (activity) {
    localStorage.setItem(ACTIVE_NAME, activity ? "1" : "0");
  },
  toggleUI: function () {
    if (this.hidden) {
      this.showUI();
      this.showInfoElements();
    } else {
      this.hideUI();
      this.hideInfoElements();
    }
    this.setStorageHidden(this.hidden);
  },
  setStorageHidden: function (val) {
    localStorage.setItem(STH_HIDDEN, val ? "1" : "0");
  },
  showUI: function () {
    this.uiContainer.style["margin-right"] = marginRightOffset.toString() + "px";
    this.hidden = false;
  },
  hideUI: function () {
    this.uiContainer.style["margin-right"] = "-" + (marginRightOffset + this.uiContainer.offsetWidth).toString() + "px";
    this.hidden = true;
  },
  showInfoElements: function () {
    this.infoElements.forEach(element => element.style.opacity = element.dataset.opacity);
  },
  hideInfoElements: function () {
    this.infoElements.forEach(element => element.style.opacity = 0);
  },
  buttonActionHandler: function (e) {
    switch (e.type) {
      case "keydown":
        this.handleKeyDown(e.keyCode);
        break;
      case "click":
        this.enterDummyResponse();
        this.clickNextButton();
        break;
      default:
        console.log("buttonActionHandler: Did nothing.");
    }
  },
  handleKeyDown: function (keyCode) {
    if (this.hidden) {
      if (keyCode === BUTTON_CODES.esc) {
        this.toggleUI();
      }
    } else {
      switch (keyCode) {
        case BUTTON_CODES.right:
          this.enterDummyResponse();
          // Fallthrough
        case BUTTON_CODES.enter:
          this.clickNextButton();
          break;
        case BUTTON_CODES.left:
          this.clickPrevButton();
          break;
        case BUTTON_CODES.spacebar:
          this.setActivity(!this.active);
          break;
        case BUTTON_CODES.insert:
          this.enterDummyResponse();
          break;
        case BUTTON_CODES.esc:
          this.toggleUI();
          break;
      }
    }
  },
  getQuestionType: function () {
    let containerClasses = document.querySelector("form#limesurvey div.question-container");
    if (containerClasses) {
      containerClasses = containerClasses.classList;

      for (const typeName in QUESTION_CLASSES) {
        if (containerClasses.contains(typeName)) {
          return QUESTION_CLASSES[typeName];
        }
      }
    }
    return undefined;
  },
  getNumericContext: function () {
    // Return a context enumeration based on what the question text contains
    let questionText = document.querySelector("div.question-text").innerText.toLowerCase();
    let context = null;

    if (questionText.includes(" age") || questionText.includes("how old")) {
      context = Q_NUM_CONTEXT.age;
    }
    if (questionText.includes("postal ") || questionText.includes("zip ")) {
      context = Q_NUM_CONTEXT.zipCode;
    }
    if (questionText.includes(" many")
      || questionText.includes(" much")
      || questionText.includes(" number")
      || questionText.includes("amount")) {
      context = Q_NUM_CONTEXT.quantity;
    }
    if (questionText.includes("year ") || questionText.includes(" born") ) {
      if (questionText.includes("9999")) {
        context = Q_NUM_CONTEXT.yearRef;
      } else if (questionText.includes("0000")) {
        context = Q_NUM_CONTEXT.yearAL;
      } else {
        context = Q_NUM_CONTEXT.year;
      }
    }
    if (questionText.includes("a scale")) {
      context = Q_NUM_CONTEXT.scale;
    }
    return context;
  },
  getMCContext: function () {
    // Return a context enumeration based on what the question text contains
    let questionText = document.querySelector("div.question-text").innerText.toLowerCase();
    let context = null;

    if (questionText.includes("choos")
      || questionText.includes("select")
      || questionText.includes("pick")
      || questionText.includes(" up to ")) {
      if (questionText.includes(" two") || questionText.includes(" 2")) {
        context = Q_MC_CONTEXT.two;
      } else if (questionText.includes(" three") || questionText.includes(" 3")) {
        context = Q_MC_CONTEXT.three;
      } else if (questionText.includes(" four") || questionText.includes(" 4")) {
        context = Q_MC_CONTEXT.four;
      } else if (questionText.includes(" five") || questionText.includes(" 5")) {
        context = Q_MC_CONTEXT.five;
      }
    }
    return context;
  },
  addErrorAlertListener: function () {
    const alertElement = document.querySelector("#bootstrap-alert-box-modal");
    const config = {
      attributes: true
    };
    let observer = new MutationObserver(this.alertFoundHandler.bind(this));
    observer.observe(alertElement, config);
  },
  alertFoundHandler: function (mutationList, observer) {
    mutationList.forEach(mutation => {
      if (mutation.attributeName === "style" && mutation.target.style.display !== "none") {
        this.setAlert("Answer Invalid." + (this.active ? " Pausing run..." : ""));
        if (!this.hidden) {
          mutation.target.querySelector("div.modal-footer > a.btn.btn-default").click();
        }
        if (!this.errorDeactivateOverride) {
          this.setActivity(false);
        }
      }
    });
  },
  enterDummyResponse: function () {
    switch (this.questionType) {
      case QUESTION_TYPE.radio:
        this.selectRandomRadio();
        break;
      case QUESTION_TYPE.numericInput:
        this.enterNumericValue();
        break;
      case QUESTION_TYPE.shortFreeText:
        this.enterSFTValue();
        break;
      case QUESTION_TYPE.array:
        this.selectArrayOptions();
        break;
      case QUESTION_TYPE.mChoice:
        this.selectMultipleChoiceOptions();
        break;
      case QUESTION_TYPE.dropdown:
        this.selectRandomDropdown();
        break;
      default:
        console.log("Handleable question type not found.");
    }
  },
  clearResponses: function () {
    switch (this.questionType) {
      case QUESTION_TYPE.radio:
        this.clearRadio();
        break;
      case QUESTION_TYPE.mChoice:
        this.clearMChoice();
        break;
    }
  },
  selectRandomRadio: function () {
    let ansList = document.querySelectorAll("div.answers-list > div.answer-item");
    let ansInputList = document.querySelectorAll("div.answers-list > div.answer-item input.radio");
    let r = roll(0, ansInputList.length);
    let forced = false;

    this.clearRadio();

    try {
      if (this.commands.force && this.commands.force[this.questionCode]) {
        let forcedVal = this.commands.force[this.questionCode][roll(0, this.commands.force[this.questionCode].length)];
        for (let i = 0; i < ansInputList.length; i++) {
          if (forcedVal === ansInputList[i].value) {
            r = i;
            if (isHidden(ansInputList[r])) {
              throw "ERROR: " + this.questionCode + " - option " + forcedVal +
                " is hidden but is being used as a forced option.";
            }
            break;
          }
        }
        forced = true;
      } else {
        // Checks to see whether the option found is hidden or not
        while (isHidden(ansInputList[r])) {
          r = roll(0, ansInputList.length);
        }
      }
    }
    catch (e) {
      this.setAlert(e);
    }
    if (!forced && this.commands.avoid && this.commands.avoid[this.questionCode]) {
      let restrictedVals = this.commands.avoid[this.questionCode];
      while (restrictedVals.includes(ansInputList[r].value) || ansInputList[r].offsetWidth == 0 || ansInputList[r].offsetHeight == 0 ) {
        r = roll(0, ansInputList.length);
      }
    }

    ansList.item(r).querySelector("input.radio").checked = true;
    let otherOpt = ansList.item(r).querySelector("input.text");
    if (otherOpt) {
      let context = this.getNumericContext();
      switch (context) {
        case Q_NUM_CONTEXT.age:
        case Q_NUM_CONTEXT.percent:
          otherOpt.value = roll(18, 100);
          break;
        case Q_NUM_CONTEXT.year:
          otherOpt.value = roll(1910, validAgeYear);
          break;
        case Q_NUM_CONTEXT.zipCode:
          otherOpt.value = "90210";
          break;
        case Q_NUM_CONTEXT.quantity:
          otherOpt.value = roll(0, 20);
          break;
        case Q_NUM_CONTEXT.scale:
          otherOpt.value = roll(0, 100);
          break;
        default:  // Generic string response
          otherOpt.value = "Run at: " + getTimeStamp();
      }
    }
  },
  clearRadio: function () {
    let ansList = document.querySelectorAll("div.answers-list>div.answer-item");
    let ans;
    for (let i = 0; i < ansList.length; i++) {
      ans = ansList.item(i).querySelector("input.radio");
      if (ans.checked) {
        ans.checked = false;
        let otherOpt = ansList.item(i).querySelector("input.text");
        if (otherOpt) {
          otherOpt.value = "";
        }
        break;
      }
    }
  },
  enterNumericValue: function () {
    let inputVal = 0;
    let inputElement = document.querySelector("div.question-container input.numeric");
    let context = this.getNumericContext();

    switch (context) {
      case Q_NUM_CONTEXT.age:
      case Q_NUM_CONTEXT.percent:
        inputVal = generateNumericInput(18, 100);
        break;
      case Q_NUM_CONTEXT.year:
        inputVal = generateNumericInput(1910, validAgeYear);
        break;
      case Q_NUM_CONTEXT.zipCode:
        inputVal = 90210;
        break;
      case Q_NUM_CONTEXT.yearRef:
        // Year except with a refused option
        inputVal = generateNumericInput(1910, validAgeYear, 9999);
        break;
      case Q_NUM_CONTEXT.yearAL:
        // Client-specific year w/ refused option
        inputVal = generateNumericInput(1910, validAgeYear, 0);
        break;
      default:  // Probably a quantity or something
        inputVal = roll(0, 20);
    }

    inputElement.value = inputVal;
  },
  enterSFTValue: function () {
    let inputElement = document.querySelector("div.question-container input.text");

    inputElement.value = "Run at: " + getTimeStamp();
  },
  selectArrayOptions: function () {
    let arrayTable = document.querySelector("table.questions-list");
    let rows = arrayTable.querySelectorAll(".answers-list");
    let options, r;
    rows.forEach(row => {
      options = row.querySelectorAll("td>input.radio");
      r = roll(0, options.length);
      options[r].checked = true;
    });
  },
  selectMultipleChoiceOptions: function () {
    let checkboxes = document.querySelectorAll("div.questions-list div.answer-item input.checkbox");
    let context = this.getMCContext();
    let numToCheck = roll(1, context ? context + 1 : Math.ceil(checkboxes.length / 2));
    let toBeChecked = [];
    let r = 0;
    let forced = false;
    let restrictedVals = [];
    let rollAttempts = 0;

    let qID = document.querySelector("div.question-container").id.replace("question","");
    let subquestionCodes = function () {
      sqCodes = [];

      document.querySelectorAll("div.questions-list > div > div.answer-item").forEach(function (e) {
        sqCodes.push(e.id.split(qID)[1]);
      });
      return sqCodes;
    }();

    // Clear the checkboxes before re-selecting them
    this.clearMChoice();

    try {
      if (this.commands.force && this.commands.force[this.questionCode]) {
        let forcedVals = this.commands.force[this.questionCode];
        for (let i = 0; i < subquestionCodes.length 
          && toBeChecked.length < numToCheck
          && toBeChecked.length < forcedVals.length; i++) {
          if (forcedVals.includes(subquestionCodes[i])) {
            checkboxes[i].checked = true;
            if (isHidden(checkboxes[i])) {
              throw "ERROR: " + this.questionCode + " - option " + subquestionCodes[i] +
                " is hidden but is being used as a forced option.";
            }
            toBeChecked.push(i);
          }
        }
        forced = true;
      }
    }
    catch (e) {
      this.setAlert(e);
    }
    if (!forced && this.commands.avoid && this.commands.avoid[this.questionCode]) {
      restrictedVals = this.commands.avoid[this.questionCode];
    }

    while (rollAttempts < 10 && toBeChecked.length < numToCheck) {
      r = roll(0, checkboxes.length);
      if (!checkboxes[r].checked
        && checkboxes[r].closest("div.answer-item").style.display != "none"
        && !restrictedVals.includes(subquestionCodes[r])) {
        checkboxes[r].checked = true;
        if (checkboxes[r].classList.contains("other-checkbox")) {
          checkboxes[r].closest("div.answer-item").querySelector("input.text").value = getTimeStamp();
        }
        toBeChecked.push(r);
      } else {
        rollAttempts++;
      }
    }
  },
  clearMChoice: function () {
    let checkboxes = document.querySelectorAll("div.questions-list div.answer-item input.checkbox");

    checkboxes.forEach(chkbox => {
      if (chkbox.checked) {
        chkbox.click();
      }
      if (chkbox.classList.contains("other-checkbox")) {
        chkbox.closest("div.answer-item").querySelector("input.text").value = "";
      }
    });
  },
  selectRandomDropdown: function () {
    let dropdownElements = document.querySelector("div.question-container select.list-question-select");
    let r = roll(0, dropdownElements.length);
    let forced = false;

    if (this.commands.force && this.commands.force[this.questionCode]) {
      let forcedVal = this.commands.force[this.questionCode][roll(0, this.commands.force[this.questionCode].length)];
      for (let i = 0; i < dropdownElements.length; i++) {
        if (forcedVal === dropdownElements[i].value) {
          r = i;
          break;
        }
      }
      forced = true;
    } else {
      // Roll until we reach an option with a value
      while (!dropdownElements[r].value) {
        r = roll(0, dropdownElements.length);
      }
    }
    if (!forced && this.commands.avoid && this.commands.avoid[this.questionCode]) {
      let restrictedVals = this.commands.avoid[this.questionCode];
      while (!dropdownElements[r].value || restrictedVals.includes(dropdownElements[r].value)) {
        r = roll(0, dropdownElements.length);
      }
    }

    dropdownElements[r].selected = true;
  },
  queryCommands: function () {
    // commands are html tags with data attributes of the same name containing
    // question codes and answer codes in the form "QX,1,2,3|QX2,1,2,3"
    let commandList = document.querySelectorAll(STH_COMMANDS.join(","));
    let commandContainer = {};
    for (let x = 0; x < STH_COMMANDS.length; x++) {
      commandContainer[STH_COMMANDS[x]] = null;
    }

    if (commandList.length > 0) {
      commandList.forEach(cmd => {
        let tempCmd = {};
        let questionData = cmd.dataset[cmd.localName].split("|");

        for (let i = 0; i < questionData.length; i++) {
          let arrTemp = questionData[i].split(" ").join("").split(",");
          let qName = arrTemp.shift();

          tempCmd[qName] = arrTemp;
        }

        commandContainer[cmd.localName] = tempCmd;
      });
      this.commandsFound = true;
    }

    return commandContainer;
  },
  generateArrayInfoDisplay: function () {
    let rows = document.querySelectorAll("tbody > tr.answers-list");
    let headerCols = document.querySelectorAll("thead th.th-9");
    let firstRowCells = rows[0].querySelectorAll("td.answer-item > input");
    let qID = document.querySelector("div.question-container").id.replace("question","");

    // Subquestion code display
    for (let i = 0; i < rows.length; i++) {
      let infoDiv = document.createElement("div");
      infoDiv.innerHTML = rows[i].id.split(qID)[1];
      infoDiv.style.position = "absolute";
      infoDiv.style.right = "100%";
      infoDiv.style.padding = "3px 0.5em";
      infoDiv.style.color = "white";
      infoDiv.style.opacity = this.hidden ? 0 : 0.75;
      infoDiv.style["background-color"] = "orangered";
      infoDiv.style["border-radius"] = "50% 0 0 10%";
      infoDiv.style["font-weight"] = "bold";
      infoDiv.style["transition-duration"] = "0.5s";

      rows[i].appendChild(infoDiv);

      this.infoElements.push(infoDiv);
    }

    let rowHeight = headerCols[0].offsetHeight.toString() + "px";
    // Answer option value display
    for (let j = 0; j < firstRowCells.length; j++) {
      let infoDiv = document.createElement("div");
      infoDiv.innerHTML = firstRowCells[j].value;
      infoDiv.style.position = "absolute";
      infoDiv.style.top = "-" + rowHeight;
      infoDiv.style.left = "50%";
      infoDiv.style.padding = "3px 0.5em";
      infoDiv.style.opacity = this.hidden ? 0 : 0.75;
      infoDiv.style["transform"] = "translate(-50%, -100%)";
      infoDiv.style["border-radius"] = "45% 45% 5px 5px";

      infoDiv.dataset.opacity = 0.75;

      let infoDivContainer = document.createElement("div");
      infoDivContainer.style.position = "relative";

      infoDivContainer.appendChild(infoDiv);
      headerCols[j].appendChild(infoDivContainer);

      this.infoElements.push(infoDiv);
    }
  },
  generateRadioInfoDisplay: function () {
    let ansList = document.querySelectorAll("div.answers-list > div.answer-item input.radio");

    // Answer option value display
    for (let i = 0; i < ansList.length; i++) {
      let infoDiv = document.createElement("div");
      infoDiv.innerHTML = ansList[i].value;
      infoDiv.style.position = "absolute";
      infoDiv.style.top = "-0.3em";
      infoDiv.style.opacity = this.hidden ? 0 : 0.75;
      infoDiv.style.right = "100%";
      infoDiv.style.padding = "3px";
      infoDiv.style.hyphens = "none";
      infoDiv.style.height = "28px";
      infoDiv.style.width = "fit-content";
      infoDiv.style["min-width"] = "28px";
      infoDiv.style["text-align"] = "center";
      infoDiv.style["margin-right"] = "1em";
      infoDiv.style["border-radius"] = "30px";
      infoDiv.style["padding-top"] = "0.2em";

      infoDiv.dataset.opacity = 0.75;

      ansList[i].closest("div.answer-item").appendChild(infoDiv);

      this.infoElements.push(infoDiv);
    }
  },
  generateMChoiceInfoDisplay: function () {
    let choiceList = document.querySelectorAll("div.questions-list > div > div.answer-item");
    let qID = document.querySelector("div.question-container").id.replace("question","");

    for (let i = 0; i < choiceList.length; i++) {
      let infoDiv = document.createElement("div");
      infoDiv.innerHTML = choiceList[i].id.split(qID)[1];
      infoDiv.style.position = "absolute";
      infoDiv.style.top = "-0.3em";
      infoDiv.style.opacity = this.hidden ? 0 : 0.75;
      infoDiv.style.right = "100%";
      infoDiv.style.padding = "3px";
      infoDiv.style.hyphens = "none";
      infoDiv.style.height = "28px";
      infoDiv.style.width = "fit-content";
      infoDiv.style["min-width"] = "28px";
      infoDiv.style["text-align"] = "center";
      infoDiv.style["margin-right"] = "-0.5em";
      infoDiv.style["border-radius"] = "30px";
      infoDiv.style["padding-top"] = "0.2em";

      infoDiv.dataset.opacity = 0.75;

      choiceList[i].appendChild(infoDiv);

      this.infoElements.push(infoDiv);
    }
  }
};

function roll (min, max) {
  return (Math.random() * (max - min) + min) | 0;
};

function generateNumericInput (min, max, refusedVal=-1) {
  let returnVal = 0;
  // 20% chance of returning refused option, if provided
  if (refusedVal > -1) {
    returnVal = (roll(0, 100) < 20) ? refusedVal : roll(min, max);
  } else {
    returnVal = roll(min, max);
  }
  return returnVal;
};

function getTimeStamp () {
  return String(curDate.getMonth() + 1).padStart(2, "0") + "-" +
    String(curDate.getDate()).padStart(2, "0") + " " +
    String(curDate.getHours()).padStart(2,"0") + ":" +
    String(curDate.getMinutes()).padStart(2,"0");
}

function isHidden(element) {
  return (element.offsetWidth == 0 || element.offsetHeight == 0 );
}

var marginRightOffset = 15;

// Delay initialization so that LS has a chance to properly manage its UI before we start
window.setTimeout(function () {
  SurveyTestHelper.initialize();
}, 10);
