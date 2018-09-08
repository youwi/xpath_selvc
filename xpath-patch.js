/**
 *  找到最佳xpath
 *  方案1: 用邻近文字
 *  方案2: 相对路径
 *  方案3: 使用独特值.
 *  方案4: 图标特殊
 *
 *  by youwi@github
 *  当前代码没有怎么专注性能.
 *
 */


/**
 * Copyright 2011 Google Inc. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * @author opensource@google.com
 * @license Apache License, Version 2.0.
 */
var xh = xh || {};
xh.test_count = 0;//for performance test
xh.itr_count = 0;
xh.found_count = 0; // for performance test

xh.LEVEL_LIMIT = 7; // fun recursive call limit
xh.RES_LIMIT = 30;  // max result
xh.ITR_LIMIT = 1000;// for performance test
xh.TEXT_LIMIT = 20; // for xpath text() lmint

function checkPathThenPush(path, list, originalElement) {
  let foundCount = xh.evaluateUniqueClassName(path, originalElement);
  if (foundCount === 1) {
    list.push(path);
    xh.found_count++;
    return true;
  }
  return false;
}

/**
 *  see https://stackoverflow.com/questions/17727977/how-to-get-all-text-from-all-tags-in-one-array
 *  dom =>text array
 *  not innerText
 * @return {Array}
 */
function getChildNodeTexts(element, array, level) {
  array = array || [];
  level = level || 0;
  let elements = element.childNodes;
  for (let i = 0; i < elements.length; i++) {
    let current = elements[i];
    if (current.children && current.children.length === 0 && current.textContent.replace(/ |\n/g, "") !== "") {
      array.push({text: current.textContent, tagName: current.tagName.toLowerCase(), level: level});
    } else if (current.nodeName !== "#text") {
      getChildNodeTexts(current, array, level + 1);
    } else if (current.nodeName === "#text") {
      if (current.textContent.trim() !== "")
        array.push({text: current.textContent, tagName: element.tagName.toLowerCase(), level: level, self: true});
    }
  }
  return array;
}

/**
 *  if parent has uniqe attr,
 *  get it.
 */
function findParentOnlyAttr(el, level) {
  level = level || 0;
  let normalAttr = ["class", "style"];
  let attNames = el.getAttributeNames();
  let currentElement = el;
  while (currentElement) {
    if (level > xh.LEVEL_LIMIT || currentElement === document) break;
    for (let name of attNames) {
      if (normalAttr.indexOf(name) > 0) continue;
      if (xh.evaluateUniqueClassName(`//${el.tagName.toLowerCase()}[@${name}="${el.getAttribute(name)}"]`) === 1) {
        return {tagName: el.tagName.toLowerCase(), level: level, attrName: name, attrValue: el.getAttribute(name)};
      }
    }
    currentElement = currentElement.parentElement;
  }
  return null;
}

/**
 * 为特殊path做的标记
 * 查询特殊id
 *
 * @param el element DOM.
 */
xh.findBySpAttr = function (el) {
  xh.found_count = 0;
  if (el === document.body) return [];
  let out = [];
  let normalAttr = ["class", "style"];
  let originalElementTagName = el.tagName.toLowerCase();


  if (el.innerText.length < 20) {
    checkPathThenPush(`//${el.tagName.toLowerCase()}[text()="${el.innerText}"]`, out, el);
  }
  let attNames = el.getAttributeNames();
  let attNamesParent = el.parentElement.getAttributeNames();
  let parentEl = el.parentElement;
  let found;
  for (let name of attNames) {
    if (normalAttr.indexOf(name) > 0) continue;
    found = checkPathThenPush(`//${el.tagName.toLowerCase()}[@${name}="${el.getAttribute(name)}"]`, out, el);
  }

  if (!found) {
    for (let nameParent of attNamesParent) {
      for (let name of attNames) {
        let tagNameParent = parentEl.tagName.toLowerCase();
        let pValue = parentEl.getAttribute(nameParent);
        checkPathThenPush(`//${tagNameParent}[@${nameParent}="${pValue}"]/${originalElementTagName}[@${name}="${el.getAttribute(name)}"]`, out, el);
        if (out.length > xh.RES_LIMIT || xh.itr_count > xh.ITR_LIMIT) {
          return out;
        }
      }
    }
  }
  let onlyAttr = findParentOnlyAttr(el);
  if (onlyAttr) {
    checkPathThenPush(`//${onlyAttr.tagName}[@${onlyAttr.attrName}="${onlyAttr.attrValue}"]//${originalElementTagName}`, out);
  }

  let currentElement = el;
  let level = 0;
  let levelTag = "";
  while (currentElement) {
    level++;
    if (level > xh.LEVEL_LIMIT || currentElement === document) break;

    let tagName = currentElement.tagName.toLowerCase();
    levelTag = tagName + levelTag;

    let textArrays = getChildNodeTexts(currentElement);
    let found = false;
    for (let item of textArrays) {
      let cTagName = item.tagName;
      let cText = item.text;
      let cLevel = "../".repeat(item.level + 1);
      let needTrim = isMultiLineOrNeedTrim(cText);
      if (needTrim && item.self) {
        found = checkPathThenPush(`//${cTagName}[contains(text(),"${cText.trim()}")]`, out, el);
      } else if (needTrim && (item.self !== true)) {
        found = checkPathThenPush(`//${cTagName}[contains(text(),"${cText.trim()}")]/${cLevel}/${originalElementTagName}`, out, el);
        if (isShortLinkText(el)) {
          found = checkPathThenPush(`//${cTagName}[contains(text(),"${cText.trim()}")]/${cLevel}/${originalElementTagName}[text()="${el.innerText}"]`, out, el);
        }
      } else if (!needTrim && item.self) {
        found = checkPathThenPush(`//${cTagName}[text()="${cText}"]`, out, el);
      } else if (!needTrim && !item.self) {
        found = checkPathThenPush(`//${cTagName}[text()="${cText}"]/${cLevel}/${originalElementTagName}`, out, el);
        if (isShortLinkText(el)) {
          found = checkPathThenPush(`//${cTagName}[text()="${cText}"]/${cLevel}/${originalElementTagName}[text()="${el.innerText}"]`, out, el);
        }
      }
      if (out.length > xh.RES_LIMIT || xh.itr_count > xh.ITR_LIMIT) {
        return out;
      }
      if (found) break;
    }

    if (el.innerText.length < xh.TEXT_LIMIT) {
      checkPathThenPush(`//${tagName}[text()="${getChildNodeTexts(currentElement)}"]`, out, el);
    }

    currentElement = currentElement.parentNode;
    if (out.length > xh.RES_LIMIT || xh.itr_count > xh.ITR_LIMIT) {
      return out;
    }
    if (found) break;
  }

  return out;
};

function isShortLinkText(el) {
  return el.innerText.length < xh.TEXT_LIMIT && el.innerText.length > 0 && el.innerText.trim() === el.innerText;
}

/**
 * text need trim?
 * @param str
 * @return {boolean}
 */
function isMultiLineOrNeedTrim(str) {
  if (str == null) return false;

  if (str.indexOf("\n") === 0) {
    return true;
  }
  if (str.split("\n").length > 1) {
    return true;
  }
  if (str.trim().length - str.length > 5) {
    return true;
  }
}

/**
 * find parent  <div prop='abc'>  for vue.js
 */
xh.getElementByTagProp = function (el) {
  if (el == null) return null;
  let newElement = el;
  let out = null;
  let level = 0;
  let commentText = "";
  while (newElement) {
    level++;

    if (newElement.getAttribute("prop")) {

      if (newElement.innerText && newElement.innerText.length < xh.TEXT_LIMIT) {
        commentText = newElement.innerText;
      }
      out = "//" + newElement.tagName.toLowerCase() + "[@prop='" + newElement.getAttribute("prop") + "'" + " and '" + commentText + "']";
      return out;
    }
    if (level > xh.LEVEL_LIMIT) break;
    newElement = newElement.parentNode;
    if (newElement === document) break;
  }
  return out;
};

/**
 * find out is th unique xpath.
 * @param query  xpath
 * @return number  match count
 */

xh.evaluateUniqueClassName = function (query, originalElement) {
  xh.test_count++;
  let xpathResult = null;
  let nodeCount = 0;

  try {
    xpathResult = document.evaluate(query, document, null, XPathResult.ANY_TYPE, null);
  } catch (e) {
    nodeCount = 0;
  }

  if (!xpathResult) {
    return nodeCount;
  }

  if (xpathResult.resultType === XPathResult.BOOLEAN_TYPE) {
    nodeCount = 1;
  } else if (xpathResult.resultType === XPathResult.NUMBER_TYPE) {
    nodeCount = 1;
  } else if (xpathResult.resultType === XPathResult.STRING_TYPE) {
    nodeCount = 1;
  } else if (xpathResult.resultType === XPathResult.UNORDERED_NODE_ITERATOR_TYPE) {
    for (let node = xpathResult.iterateNext(); node; node = xpathResult.iterateNext()) {
      nodeCount++;
      xh.itr_count++;
      //查询元素只允许一次循环
      if (originalElement !== null && node.nodeType === Node.ELEMENT_NODE && node !== originalElement) {
        return -2;
      }
    }
  } else {
    nodeCount = 0;
  }

  return nodeCount;
};

