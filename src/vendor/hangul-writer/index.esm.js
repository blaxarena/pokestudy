/**
 * Hangul Writer v1.0.1 | https://github.com/mirodn/hangul-writer
 */

var _globalObj$requestAni, _globalObj$cancelAnim, _globalObj$navigator; // hacky way to get around rollup not properly setting `global` to `window` in browser


const globalObj = typeof window === 'undefined' ? global : window;
const performanceNow = globalObj.performance && (() => globalObj.performance.now()) || (() => Date.now());
const requestAnimationFrame = ((_globalObj$requestAni = globalObj.requestAnimationFrame) === null || _globalObj$requestAni === void 0 ? void 0 : _globalObj$requestAni.bind(globalObj)) || (callback => setTimeout(() => callback(performanceNow()), 1000 / 60));
const cancelAnimationFrame = ((_globalObj$cancelAnim = globalObj.cancelAnimationFrame) === null || _globalObj$cancelAnim === void 0 ? void 0 : _globalObj$cancelAnim.bind(globalObj)) || clearTimeout; // Object.assign polyfill, because IE :/
function arrLast(arr) {
  return arr[arr.length - 1];
}
const fixIndex = (index, length) => {
  // helper to handle negative indexes in array indices
  if (index < 0) {
    return length + index;
  }

  return index;
};
const selectIndex = (arr, index) => {
  // helper to select item from array at index, supporting negative indexes
  return arr[fixIndex(index, arr.length)];
};
function copyAndMergeDeep(base, override) {
  const output = { ...base
  };

  for (const key in override) {
    const baseVal = base[key];
    const overrideVal = override[key];

    if (baseVal === overrideVal) {
      continue;
    }

    if (baseVal && overrideVal && typeof baseVal === 'object' && typeof overrideVal === 'object' && !Array.isArray(overrideVal)) {
      output[key] = copyAndMergeDeep(baseVal, overrideVal);
    } else {
      // @ts-ignore
      output[key] = overrideVal;
    }
  }

  return output;
}
/** basically a simplified version of lodash.get, selects a key out of an object like 'a.b' from {a: {b: 7}} */

function inflate(scope, obj) {
  const parts = scope.split('.');
  const final = {};
  let current = final;

  for (let i = 0; i < parts.length; i++) {
    const cap = i === parts.length - 1 ? obj : {};
    current[parts[i]] = cap;
    current = cap;
  }

  return final;
}
let count = 0;
function counter() {
  count++;
  return count;
}
function average(arr) {
  const sum = arr.reduce((acc, val) => val + acc, 0);
  return sum / arr.length;
}
function colorStringToVals(colorString) {
  const normalizedColor = colorString.toUpperCase().trim(); // based on https://stackoverflow.com/a/21648508

  if (/^#([A-F0-9]{3}){1,2}$/.test(normalizedColor)) {
    let hexParts = normalizedColor.substring(1).split('');

    if (hexParts.length === 3) {
      hexParts = [hexParts[0], hexParts[0], hexParts[1], hexParts[1], hexParts[2], hexParts[2]];
    }

    const hexStr = `${hexParts.join('')}`;
    return {
      r: parseInt(hexStr.slice(0, 2), 16),
      g: parseInt(hexStr.slice(2, 4), 16),
      b: parseInt(hexStr.slice(4, 6), 16),
      a: 1
    };
  }

  const rgbMatch = normalizedColor.match(/^RGBA?\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(\d*\.?\d+))?\)$/);

  if (rgbMatch) {
    return {
      r: parseInt(rgbMatch[1], 10),
      g: parseInt(rgbMatch[2], 10),
      b: parseInt(rgbMatch[3], 10),
      // @ts-expect-error ts-migrate(2554) FIXME: Expected 1 arguments, but got 2.
      a: parseFloat(rgbMatch[4] || 1, 10)
    };
  }

  throw new Error(`Invalid color: ${colorString}`);
}
const trim = string => string.replace(/^\s+/, '').replace(/\s+$/, ''); // return a new array-like object with int keys where each key is item
// ex: objRepeat({x: 8}, 3) === {0: {x: 8}, 1: {x: 8}, 2: {x: 8}}

function objRepeat(item, times) {
  const obj = {};

  for (let i = 0; i < times; i++) {
    obj[i] = item;
  }

  return obj;
} // similar to objRepeat, but takes in a callback which is called for each index in the object

function objRepeatCb(times, cb) {
  const obj = {};

  for (let i = 0; i < times; i++) {
    obj[i] = cb(i);
  }

  return obj;
}
const ua = ((_globalObj$navigator = globalObj.navigator) === null || _globalObj$navigator === void 0 ? void 0 : _globalObj$navigator.userAgent) || '';
const isMsBrowser = ua.indexOf('MSIE ') > 0 || ua.indexOf('Trident/') > 0 || ua.indexOf('Edge/') > 0; // eslint-disable-next-line @typescript-eslint/no-empty-function

const noop = () => {};

class RenderState {
  constructor(character, options, onStateChange = noop) {
    this._mutationChains = [];
    this._onStateChange = onStateChange;
    this.state = {
      options: {
        drawingFadeDuration: options.drawingFadeDuration,
        drawingWidth: options.drawingWidth,
        drawingColor: colorStringToVals(options.drawingColor),
        strokeColor: colorStringToVals(options.strokeColor),
        outlineColor: colorStringToVals(options.outlineColor),
        radicalColor: colorStringToVals(options.radicalColor || options.strokeColor),
        highlightColor: colorStringToVals(options.highlightColor)
      },
      character: {
        main: {
          opacity: options.showCharacter ? 1 : 0,
          strokes: {}
        },
        outline: {
          opacity: options.showOutline ? 1 : 0,
          strokes: {}
        },
        highlight: {
          opacity: 1,
          strokes: {}
        }
      },
      userStrokes: null
    };

    for (let i = 0; i < character.strokes.length; i++) {
      this.state.character.main.strokes[i] = {
        opacity: 1,
        displayPortion: 1
      };
      this.state.character.outline.strokes[i] = {
        opacity: 1,
        displayPortion: 1
      };
      this.state.character.highlight.strokes[i] = {
        opacity: 0,
        displayPortion: 1
      };
    }
  }

  overwriteOnStateChange(onStateChange) {
    this._onStateChange = onStateChange;
  }

  updateState(stateChanges) {
    const nextState = copyAndMergeDeep(this.state, stateChanges);

    this._onStateChange(nextState, this.state);

    this.state = nextState;
  }

  run(mutations, options = {}) {
    const scopes = mutations.map(mut => mut.scope);
    this.cancelMutations(scopes);
    return new Promise(resolve => {
      const mutationChain = {
        _isActive: true,
        _index: 0,
        _resolve: resolve,
        _mutations: mutations,
        _loop: options.loop,
        _scopes: scopes
      };

      this._mutationChains.push(mutationChain);

      this._run(mutationChain);
    });
  }

  _run(mutationChain) {
    if (!mutationChain._isActive) {
      return;
    }

    const mutations = mutationChain._mutations;

    if (mutationChain._index >= mutations.length) {
      if (mutationChain._loop) {
        mutationChain._index = 0; // eslint-disable-line no-param-reassign
      } else {
        mutationChain._isActive = false; // eslint-disable-line no-param-reassign

        this._mutationChains = this._mutationChains.filter(chain => chain !== mutationChain); // The chain is done - resolve the promise to signal it finished successfully

        mutationChain._resolve({
          canceled: false
        });

        return;
      }
    }

    const activeMutation = mutationChain._mutations[mutationChain._index];
    activeMutation.run(this).then(() => {
      if (mutationChain._isActive) {
        mutationChain._index++; // eslint-disable-line no-param-reassign

        this._run(mutationChain);
      }
    });
  }

  _getActiveMutations() {
    return this._mutationChains.map(chain => chain._mutations[chain._index]);
  }

  pauseAll() {
    this._getActiveMutations().forEach(mutation => mutation.pause());
  }

  resumeAll() {
    this._getActiveMutations().forEach(mutation => mutation.resume());
  }

  cancelMutations(scopesToCancel) {
    for (const chain of this._mutationChains) {
      for (const chainId of chain._scopes) {
        for (const scopeToCancel of scopesToCancel) {
          if (chainId.startsWith(scopeToCancel) || scopeToCancel.startsWith(chainId)) {
            this._cancelMutationChain(chain);
          }
        }
      }
    }
  }

  cancelAll() {
    this.cancelMutations(['']);
  }

  _cancelMutationChain(mutationChain) {
    var _mutationChain$_resol;

    mutationChain._isActive = false;

    for (let i = mutationChain._index; i < mutationChain._mutations.length; i++) {
      mutationChain._mutations[i].cancel(this);
    }

    (_mutationChain$_resol = mutationChain._resolve) === null || _mutationChain$_resol === void 0 ? void 0 : _mutationChain$_resol.call(mutationChain, {
      canceled: true
    });
    this._mutationChains = this._mutationChains.filter(chain => chain !== mutationChain);
  }

}

const subtract = (p1, p2) => ({
  x: p1.x - p2.x,
  y: p1.y - p2.y
});
const magnitude = point => Math.sqrt(Math.pow(point.x, 2) + Math.pow(point.y, 2));
const distance = (point1, point2) => magnitude(subtract(point1, point2));
const equals = (point1, point2) => point1.x === point2.x && point1.y === point2.y;
const round = (point, precision = 1) => {
  const multiplier = precision * 10;
  return {
    x: Math.round(multiplier * point.x) / multiplier,
    y: Math.round(multiplier * point.y) / multiplier
  };
};
const length = points => {
  let lastPoint = points[0];
  const pointsSansFirst = points.slice(1);
  return pointsSansFirst.reduce((acc, point) => {
    const dist = distance(point, lastPoint);
    lastPoint = point;
    return acc + dist;
  }, 0);
};
const cosineSimilarity = (point1, point2) => {
  const rawDotProduct = point1.x * point2.x + point1.y * point2.y;
  return rawDotProduct / magnitude(point1) / magnitude(point2);
};
/**
 * return a new point, p3, which is on the same line as p1 and p2, but distance away
 * from p2. p1, p2, p3 will always lie on the line in that order
 */

const _extendPointOnLine = (p1, p2, dist) => {
  const vect = subtract(p2, p1);
  const norm = dist / magnitude(vect);
  return {
    x: p2.x + norm * vect.x,
    y: p2.y + norm * vect.y
  };
};
/** based on http://www.kr.tuwien.ac.at/staff/eiter/et-archive/cdtr9464.pdf */

const frechetDist = (curve1, curve2) => {
  const longCurve = curve1.length >= curve2.length ? curve1 : curve2;
  const shortCurve = curve1.length >= curve2.length ? curve2 : curve1;

  const calcVal = (i, j, prevResultsCol, curResultsCol) => {
    if (i === 0 && j === 0) {
      return distance(longCurve[0], shortCurve[0]);
    }

    if (i > 0 && j === 0) {
      return Math.max(prevResultsCol[0], distance(longCurve[i], shortCurve[0]));
    }

    const lastResult = curResultsCol[curResultsCol.length - 1];

    if (i === 0 && j > 0) {
      return Math.max(lastResult, distance(longCurve[0], shortCurve[j]));
    }

    return Math.max(Math.min(prevResultsCol[j], prevResultsCol[j - 1], lastResult), distance(longCurve[i], shortCurve[j]));
  };

  let prevResultsCol = [];

  for (let i = 0; i < longCurve.length; i++) {
    const curResultsCol = [];

    for (let j = 0; j < shortCurve.length; j++) {
      // we only need the results from i - 1 and j - 1 to continue the calculation
      // so we only need to hold onto the last column of calculated results
      // prevResultsCol is results[i-1][:] in the original algorithm
      // curResultsCol is results[i][:j-1] in the original algorithm
      curResultsCol.push(calcVal(i, j, prevResultsCol, curResultsCol));
    }

    prevResultsCol = curResultsCol;
  }

  return prevResultsCol[shortCurve.length - 1];
};
/** break up long segments in the curve into smaller segments of len maxLen or smaller */

const subdivideCurve = (curve, maxLen = 0.05) => {
  const newCurve = curve.slice(0, 1);

  for (const point of curve.slice(1)) {
    const prevPoint = newCurve[newCurve.length - 1];
    const segLen = distance(point, prevPoint);

    if (segLen > maxLen) {
      const numNewPoints = Math.ceil(segLen / maxLen);
      const newSegLen = segLen / numNewPoints;

      for (let i = 0; i < numNewPoints; i++) {
        newCurve.push(_extendPointOnLine(point, prevPoint, -1 * newSegLen * (i + 1)));
      }
    } else {
      newCurve.push(point);
    }
  }

  return newCurve;
};
/** redraw the curve using numPoints equally spaced out along the length of the curve */

const outlineCurve = (curve, numPoints = 30) => {
  const curveLen = length(curve);
  const segmentLen = curveLen / (numPoints - 1);
  const outlinePoints = [curve[0]];
  const endPoint = arrLast(curve);
  const remainingCurvePoints = curve.slice(1);

  for (let i = 0; i < numPoints - 2; i++) {
    let lastPoint = arrLast(outlinePoints);
    let remainingDist = segmentLen;
    let outlinePointFound = false;

    while (!outlinePointFound) {
      const nextPointDist = distance(lastPoint, remainingCurvePoints[0]);

      if (nextPointDist < remainingDist) {
        remainingDist -= nextPointDist;
        lastPoint = remainingCurvePoints.shift();
      } else {
        const nextPoint = _extendPointOnLine(lastPoint, remainingCurvePoints[0], remainingDist - nextPointDist);

        outlinePoints.push(nextPoint);
        outlinePointFound = true;
      }
    }
  }

  outlinePoints.push(endPoint);
  return outlinePoints;
};
/** translate and scale from https://en.wikipedia.org/wiki/Procrustes_analysis */

const normalizeCurve = curve => {
  const outlinedCurve = outlineCurve(curve);
  const meanX = average(outlinedCurve.map(point => point.x));
  const meanY = average(outlinedCurve.map(point => point.y));
  const mean = {
    x: meanX,
    y: meanY
  };
  const translatedCurve = outlinedCurve.map(point => subtract(point, mean));
  const scale = Math.sqrt(average([Math.pow(translatedCurve[0].x, 2) + Math.pow(translatedCurve[0].y, 2), Math.pow(arrLast(translatedCurve).x, 2) + Math.pow(arrLast(translatedCurve).y, 2)]));
  const scaledCurve = translatedCurve.map(point => ({
    x: point.x / scale,
    y: point.y / scale
  }));
  return subdivideCurve(scaledCurve);
}; // rotate around the origin

const rotate = (curve, theta) => {
  return curve.map(point => ({
    x: Math.cos(theta) * point.x - Math.sin(theta) * point.y,
    y: Math.sin(theta) * point.x + Math.cos(theta) * point.y
  }));
}; // remove intermediate points that are on the same line as the points to either side

const _filterParallelPoints = points => {
  if (points.length < 3) return points;
  const filteredPoints = [points[0], points[1]];
  points.slice(2).forEach(point => {
    const numFilteredPoints = filteredPoints.length;
    const curVect = subtract(point, filteredPoints[numFilteredPoints - 1]);
    const prevVect = subtract(filteredPoints[numFilteredPoints - 1], filteredPoints[numFilteredPoints - 2]); // this is the z coord of the cross-product. If this is 0 then they're parallel

    const isParallel = curVect.y * prevVect.x - curVect.x * prevVect.y === 0;

    if (isParallel) {
      filteredPoints.pop();
    }

    filteredPoints.push(point);
  });
  return filteredPoints;
};
function getPathString(points, close = false) {
  const start = round(points[0]);
  const remainingPoints = points.slice(1);
  let pathString = `M ${start.x} ${start.y}`;
  remainingPoints.forEach(point => {
    const roundedPoint = round(point);
    pathString += ` L ${roundedPoint.x} ${roundedPoint.y}`;
  });

  if (close) {
    pathString += 'Z';
  }

  return pathString;
}
/** take points on a path and move their start point backwards by distance */

const extendStart = (points, dist) => {
  const filteredPoints = _filterParallelPoints(points);

  if (filteredPoints.length < 2) return filteredPoints;
  const p1 = filteredPoints[1];
  const p2 = filteredPoints[0];

  const newStart = _extendPointOnLine(p1, p2, dist);

  const extendedPoints = filteredPoints.slice(1);
  extendedPoints.unshift(newStart);
  return extendedPoints;
};

class Stroke {
  constructor(path, points, strokeNum, isInRadical = false) {
    this.path = path;
    this.points = points;
    this.strokeNum = strokeNum;
    this.isInRadical = isInRadical;
  }

  getStartingPoint() {
    return this.points[0];
  }

  getEndingPoint() {
    return this.points[this.points.length - 1];
  }

  getLength() {
    return length(this.points);
  }

  getVectors() {
    let lastPoint = this.points[0];
    const pointsSansFirst = this.points.slice(1);
    return pointsSansFirst.map(point => {
      const vector = subtract(point, lastPoint);
      lastPoint = point;
      return vector;
    });
  }

  getDistance(point) {
    const distances = this.points.map(strokePoint => distance(strokePoint, point));
    return Math.min(...distances);
  }

  getAverageDistance(points) {
    const totalDist = points.reduce((acc, point) => acc + this.getDistance(point), 0);
    return totalDist / points.length;
  }

}

class Character {
  constructor(symbol, strokes) {
    this.symbol = symbol;
    this.strokes = strokes;
  }

}

function generateStrokes({
  radStrokes,
  strokes,
  medians
}) {
  const isInRadical = strokeNum => {
    var _radStrokes$indexOf;

    return ((_radStrokes$indexOf = radStrokes === null || radStrokes === void 0 ? void 0 : radStrokes.indexOf(strokeNum)) !== null && _radStrokes$indexOf !== void 0 ? _radStrokes$indexOf : -1) >= 0;
  };

  return strokes.map((path, index) => {
    const points = medians[index].map(pointData => {
      const [x, y] = pointData;
      return {
        x,
        y
      };
    });
    return new Stroke(path, points, index, isInRadical(index));
  });
}

function parseCharData(symbol, charJson) {
  const strokes = generateStrokes(charJson);
  return new Character(symbol, strokes);
}

// All character data shares the same 1024-unit bounding box (y axis pointing up)
const CHARACTER_BOUNDS = [{
  x: 0,
  y: -124
}, {
  x: 1024,
  y: 900
}];
const [from, to] = CHARACTER_BOUNDS;
const preScaledWidth = to.x - from.x;
const preScaledHeight = to.y - from.y;
class Positioner {
  constructor(options) {
    const {
      padding,
      width,
      height
    } = options;
    this.padding = padding;
    this.width = width;
    this.height = height;
    const effectiveWidth = width - 2 * padding;
    const effectiveHeight = height - 2 * padding;
    const scaleX = effectiveWidth / preScaledWidth;
    const scaleY = effectiveHeight / preScaledHeight;
    this.scale = Math.min(scaleX, scaleY);
    const xCenteringBuffer = padding + (effectiveWidth - this.scale * preScaledWidth) / 2;
    const yCenteringBuffer = padding + (effectiveHeight - this.scale * preScaledHeight) / 2;
    this.xOffset = -1 * from.x * this.scale + xCenteringBuffer;
    this.yOffset = -1 * from.y * this.scale + yCenteringBuffer;
  }

  convertExternalPoint(point) {
    const x = (point.x - this.xOffset) / this.scale;
    const y = (this.height - this.yOffset - point.y) / this.scale;
    return {
      x,
      y
    };
  }

}

const COSINE_SIMILARITY_THRESHOLD = 0; // -1 to 1, smaller = more lenient

const START_AND_END_DIST_THRESHOLD = 250; // bigger = more lenient

const FRECHET_THRESHOLD = 0.4; // bigger = more lenient

const MIN_LEN_THRESHOLD = 0.35; // smaller = more lenient

function strokeMatches(userStroke, character, strokeNum, options = {}) {
  const strokes = character.strokes;
  const points = stripDuplicates(userStroke.points);

  if (points.length < 2) {
    return {
      isMatch: false,
      meta: {
        isStrokeBackwards: false
      }
    };
  }

  const {
    isMatch,
    meta,
    avgDist
  } = getMatchData(points, strokes[strokeNum], options);

  if (!isMatch) {
    return {
      isMatch,
      meta
    };
  } // if there is a better match among strokes the user hasn't drawn yet, the user probably drew the wrong stroke


  const laterStrokes = strokes.slice(strokeNum + 1);
  let closestMatchDist = avgDist;

  for (let i = 0; i < laterStrokes.length; i++) {
    const {
      isMatch,
      avgDist
    } = getMatchData(points, laterStrokes[i], { ...options,
      checkBackwards: false
    });

    if (isMatch && avgDist < closestMatchDist) {
      closestMatchDist = avgDist;
    }
  } // if there's a better match, rather that returning false automatically, try reducing leniency instead
  // if leniency is already really high we can allow some similar strokes to pass


  if (closestMatchDist < avgDist) {
    // adjust leniency between 0.3 and 0.6 depending on how much of a better match the new match is
    const leniencyAdjustment = 0.6 * (closestMatchDist + avgDist) / (2 * avgDist);
    const {
      isMatch,
      meta
    } = getMatchData(points, strokes[strokeNum], { ...options,
      leniency: (options.leniency || 1) * leniencyAdjustment
    });
    return {
      isMatch,
      meta
    };
  }

  return {
    isMatch,
    meta
  };
}

const startAndEndMatches = (points, closestStroke, leniency) => {
  const startingDist = distance(closestStroke.getStartingPoint(), points[0]);
  const endingDist = distance(closestStroke.getEndingPoint(), points[points.length - 1]);
  return startingDist <= START_AND_END_DIST_THRESHOLD * leniency && endingDist <= START_AND_END_DIST_THRESHOLD * leniency;
}; // returns a list of the direction of all segments in the line connecting the points


const getEdgeVectors = points => {
  const vectors = [];
  let lastPoint = points[0];
  points.slice(1).forEach(point => {
    vectors.push(subtract(point, lastPoint));
    lastPoint = point;
  });
  return vectors;
};

const directionMatches = (points, stroke) => {
  const edgeVectors = getEdgeVectors(points);
  const strokeVectors = stroke.getVectors();
  const similarities = edgeVectors.map(edgeVector => {
    const strokeSimilarities = strokeVectors.map(strokeVector => cosineSimilarity(strokeVector, edgeVector));
    return Math.max(...strokeSimilarities);
  });
  const avgSimilarity = average(similarities);
  return avgSimilarity > COSINE_SIMILARITY_THRESHOLD;
};

const lengthMatches = (points, stroke, leniency) => {
  return leniency * (length(points) + 25) / (stroke.getLength() + 25) >= MIN_LEN_THRESHOLD;
};

const stripDuplicates = points => {
  if (points.length < 2) return points;
  const [firstPoint, ...rest] = points;
  const dedupedPoints = [firstPoint];

  for (const point of rest) {
    if (!equals(point, dedupedPoints[dedupedPoints.length - 1])) {
      dedupedPoints.push(point);
    }
  }

  return dedupedPoints;
};

const SHAPE_FIT_ROTATIONS = [Math.PI / 16, Math.PI / 32, 0, -1 * Math.PI / 32, -1 * Math.PI / 16];

const shapeFit = (curve1, curve2, leniency) => {
  const normCurve1 = normalizeCurve(curve1);
  const normCurve2 = normalizeCurve(curve2);
  let minDist = Infinity;
  SHAPE_FIT_ROTATIONS.forEach(theta => {
    const dist = frechetDist(normCurve1, rotate(normCurve2, theta));

    if (dist < minDist) {
      minDist = dist;
    }
  });
  return minDist <= FRECHET_THRESHOLD * leniency;
};

const getMatchData = (points, stroke, options) => {
  const {
    leniency = 1,
    isOutlineVisible = false,
    checkBackwards = true,
    averageDistanceThreshold = 350
  } = options;
  const avgDist = stroke.getAverageDistance(points);
  const distMod = isOutlineVisible || stroke.strokeNum > 0 ? 0.5 : 1;
  const withinDistThresh = avgDist <= averageDistanceThreshold * distMod * leniency; // short circuit for faster matching

  if (!withinDistThresh) {
    return {
      isMatch: false,
      avgDist,
      meta: {
        isStrokeBackwards: false
      }
    };
  }

  const startAndEndMatch = startAndEndMatches(points, stroke, leniency);
  const directionMatch = directionMatches(points, stroke);
  const shapeMatch = shapeFit(points, stroke.points, leniency);
  const lengthMatch = lengthMatches(points, stroke, leniency);
  const isMatch = withinDistThresh && startAndEndMatch && directionMatch && shapeMatch && lengthMatch;

  if (checkBackwards && !isMatch) {
    const backwardsMatchData = getMatchData([...points].reverse(), stroke, { ...options,
      checkBackwards: false
    });

    if (backwardsMatchData.isMatch) {
      return {
        isMatch,
        avgDist,
        meta: {
          isStrokeBackwards: true
        }
      };
    }
  }

  return {
    isMatch,
    avgDist,
    meta: {
      isStrokeBackwards: false
    }
  };
};

class UserStroke {
  constructor(id, startingPoint, startingExternalPoint) {
    this.id = id;
    this.points = [startingPoint];
    this.externalPoints = [startingExternalPoint];
  }

  appendPoint(point, externalPoint) {
    this.points.push(point);
    this.externalPoints.push(externalPoint);
  }

}

class Delay {
  constructor(duration) {
    this._duration = duration;
    this._startTime = null;
    this._paused = false;
    this.scope = `delay.${duration}`;
  }

  run() {
    this._startTime = performanceNow();
    this._runningPromise = new Promise(resolve => {
      this._resolve = resolve; // @ts-ignore return type of "setTimeout" in builds is parsed as `number` instead of `Timeout`

      this._timeout = setTimeout(() => this.cancel(), this._duration);
    });
    return this._runningPromise;
  }

  pause() {
    if (this._paused) return; // to pause, clear the timeout and rewrite this._duration with whatever time is remaining

    const elapsedDelay = performanceNow() - (this._startTime || 0);
    this._duration = Math.max(0, this._duration - elapsedDelay);
    clearTimeout(this._timeout);
    this._paused = true;
  }

  resume() {
    if (!this._paused) return;
    this._startTime = performanceNow(); // @ts-ignore return type of "setTimeout" in builds is parsed as `number` instead of `Timeout`

    this._timeout = setTimeout(() => this.cancel(), this._duration);
    this._paused = false;
  }

  cancel() {
    clearTimeout(this._timeout);

    if (this._resolve) {
      this._resolve();
    }

    this._resolve = undefined;
  }

}

class Mutation {
  /**
   *
   * @param scope a string representation of what fields this mutation affects from the state. This is used to cancel conflicting mutations
   * @param valuesOrCallable a thunk containing the value to set, or a callback which will return those values
   */
  constructor(scope, valuesOrCallable, options = {}) {
    this._tick = timing => {
      if (this._startPauseTime !== null) {
        return;
      }

      const progress = Math.min(1, (timing - this._startTime - this._pausedDuration) / this._duration);

      if (progress === 1) {
        this._renderState.updateState(this._values);

        this._frameHandle = undefined;
        this.cancel(this._renderState);
      } else {
        const easedProgress = ease(progress);
        const stateChanges = getPartialValues(this._startState, this._values, easedProgress);

        this._renderState.updateState(stateChanges);

        this._frameHandle = requestAnimationFrame(this._tick);
      }
    };

    this.scope = scope;
    this._valuesOrCallable = valuesOrCallable;
    this._duration = options.duration || 0;
    this._force = options.force;
    this._pausedDuration = 0;
    this._startPauseTime = null;
  }

  run(renderState) {
    if (!this._values) this._inflateValues(renderState);
    if (this._duration === 0) renderState.updateState(this._values);

    if (this._duration === 0 || isAlreadyAtEnd(renderState.state, this._values)) {
      return Promise.resolve();
    }

    this._renderState = renderState;
    this._startState = renderState.state;
    this._startTime = performanceNow();
    this._frameHandle = requestAnimationFrame(this._tick);
    return new Promise(resolve => {
      this._resolve = resolve;
    });
  }

  _inflateValues(renderState) {
    let values = this._valuesOrCallable;

    if (typeof this._valuesOrCallable === 'function') {
      values = this._valuesOrCallable(renderState.state);
    }

    this._values = inflate(this.scope, values);
  }

  pause() {
    if (this._startPauseTime !== null) {
      return;
    }

    if (this._frameHandle) {
      cancelAnimationFrame(this._frameHandle);
    }

    this._startPauseTime = performanceNow();
  }

  resume() {
    if (this._startPauseTime === null) {
      return;
    }

    this._frameHandle = requestAnimationFrame(this._tick);
    this._pausedDuration += performanceNow() - this._startPauseTime;
    this._startPauseTime = null;
  }

  cancel(renderState) {
    var _this$_resolve;

    (_this$_resolve = this._resolve) === null || _this$_resolve === void 0 ? void 0 : _this$_resolve.call(this);
    this._resolve = undefined;
    cancelAnimationFrame(this._frameHandle || -1);
    this._frameHandle = undefined;

    if (this._force) {
      if (!this._values) this._inflateValues(renderState);
      renderState.updateState(this._values);
    }
  }

}
Mutation.Delay = Delay;

function getPartialValues(startValues, endValues, progress) {
  const target = {};

  for (const key in endValues) {
    const endValue = endValues[key];
    const startValue = startValues === null || startValues === void 0 ? void 0 : startValues[key];

    if (typeof startValue === 'number' && typeof endValue === 'number' && endValue >= 0) {
      target[key] = progress * (endValue - startValue) + startValue;
    } else {
      target[key] = getPartialValues(startValue, endValue, progress);
    }
  }

  return target;
}

function isAlreadyAtEnd(startValues, endValues) {
  for (const key in endValues) {
    const endValue = endValues[key];
    const startValue = startValues === null || startValues === void 0 ? void 0 : startValues[key];

    if (endValue >= 0) {
      if (endValue !== startValue) {
        return false;
      }
    } else if (!isAlreadyAtEnd(startValue, endValue)) {
      return false;
    }
  }

  return true;
} // from https://github.com/maxwellito/vivus


const ease = x => -Math.cos(x * Math.PI) / 2 + 0.5;

const showStrokes = (charName, character, duration) => {
  return [new Mutation(`character.${charName}.strokes`, objRepeat({
    opacity: 1,
    displayPortion: 1
  }, character.strokes.length), {
    duration,
    force: true
  })];
};
const showCharacter = (charName, character, duration) => {
  return [new Mutation(`character.${charName}`, {
    opacity: 1,
    strokes: objRepeat({
      opacity: 1,
      displayPortion: 1
    }, character.strokes.length)
  }, {
    duration,
    force: true
  })];
};
const hideCharacter = (charName, character, duration) => {
  return [new Mutation(`character.${charName}.opacity`, 0, {
    duration,
    force: true
  }), ...showStrokes(charName, character, 0)];
};
const updateColor = (colorName, colorVal, duration) => {
  return [new Mutation(`options.${colorName}`, colorVal, {
    duration
  })];
};
const highlightStroke = (stroke, color, speed) => {
  const strokeNum = stroke.strokeNum;
  const duration = (stroke.getLength() + 600) / (3 * speed);
  return [new Mutation('options.highlightColor', color), new Mutation('character.highlight', {
    opacity: 1,
    strokes: {
      [strokeNum]: {
        displayPortion: 0,
        opacity: 0
      }
    }
  }), new Mutation(`character.highlight.strokes.${strokeNum}`, {
    displayPortion: 1,
    opacity: 1
  }, {
    duration
  }), new Mutation(`character.highlight.strokes.${strokeNum}.opacity`, 0, {
    duration,
    force: true
  })];
};
const animateStroke = (charName, stroke, speed) => {
  const strokeNum = stroke.strokeNum;
  const duration = (stroke.getLength() + 600) / (3 * speed);
  return [new Mutation(`character.${charName}`, {
    opacity: 1,
    strokes: {
      [strokeNum]: {
        displayPortion: 0,
        opacity: 1
      }
    }
  }), new Mutation(`character.${charName}.strokes.${strokeNum}.displayPortion`, 1, {
    duration
  })];
};
const animateSingleStroke = (charName, character, strokeNum, speed) => {
  const mutationStateFunc = state => {
    const curCharState = state.character[charName];
    const mutationState = {
      opacity: 1,
      strokes: {}
    };

    for (let i = 0; i < character.strokes.length; i++) {
      mutationState.strokes[i] = {
        opacity: curCharState.opacity * curCharState.strokes[i].opacity
      };
    }

    return mutationState;
  };

  const stroke = character.strokes[strokeNum];
  return [new Mutation(`character.${charName}`, mutationStateFunc), ...animateStroke(charName, stroke, speed)];
};
const showStroke = (charName, strokeNum, duration) => {
  return [new Mutation(`character.${charName}.strokes.${strokeNum}`, {
    displayPortion: 1,
    opacity: 1
  }, {
    duration,
    force: true
  })];
};
const animateCharacter = (charName, character, fadeDuration, speed, delayBetweenStrokes) => {
  let mutations = hideCharacter(charName, character, fadeDuration);
  mutations = mutations.concat(showStrokes(charName, character, 0));
  mutations.push(new Mutation(`character.${charName}`, {
    opacity: 1,
    strokes: objRepeat({
      opacity: 0
    }, character.strokes.length)
  }, {
    force: true
  }));
  character.strokes.forEach((stroke, i) => {
    if (i > 0) mutations.push(new Mutation.Delay(delayBetweenStrokes));
    mutations = mutations.concat(animateStroke(charName, stroke, speed));
  });
  return mutations;
};
const animateCharacterLoop = (charName, character, fadeDuration, speed, delayBetweenStrokes, delayBetweenLoops) => {
  const mutations = animateCharacter(charName, character, fadeDuration, speed, delayBetweenStrokes);
  mutations.push(new Mutation.Delay(delayBetweenLoops));
  return mutations;
};

const startQuiz = (character, fadeDuration, startStrokeNum) => {
  return [...hideCharacter('main', character, fadeDuration), new Mutation('character.highlight', {
    opacity: 1,
    strokes: objRepeat({
      opacity: 0
    }, character.strokes.length)
  }, {
    force: true
  }), new Mutation('character.main', {
    opacity: 1,
    strokes: objRepeatCb(character.strokes.length, i => ({
      opacity: i < startStrokeNum ? 1 : 0
    }))
  }, {
    force: true
  })];
};
const startUserStroke = (id, point) => {
  return [new Mutation('quiz.activeUserStrokeId', id, {
    force: true
  }), new Mutation(`userStrokes.${id}`, {
    points: [point],
    opacity: 1
  }, {
    force: true
  })];
};
const updateUserStroke = (userStrokeId, points) => {
  return [new Mutation(`userStrokes.${userStrokeId}.points`, points, {
    force: true
  })];
};
const hideUserStroke = (userStrokeId, duration) => {
  return [new Mutation(`userStrokes.${userStrokeId}.opacity`, 0, {
    duration
  })];
};
const removeAllUserStrokes = userStrokeIds => {
  return (userStrokeIds === null || userStrokeIds === void 0 ? void 0 : userStrokeIds.map(userStrokeId => new Mutation(`userStrokes.${userStrokeId}`, null, {
    force: true
  }))) || [];
};
const highlightCompleteChar = (character, color, duration) => {
  return [new Mutation('options.highlightColor', color), ...hideCharacter('highlight', character), ...showCharacter('highlight', character, duration / 2), ...hideCharacter('highlight', character, duration / 2)];
};

const getDrawnPath = userStroke => ({
  pathString: getPathString(userStroke.externalPoints),
  points: userStroke.points.map(point => round(point))
});

class Quiz {
  constructor(character, renderState, positioner) {
    this._currentStrokeIndex = 0;
    this._mistakesOnStroke = 0;
    this._totalMistakes = 0;
    this._character = character;
    this._renderState = renderState;
    this._isActive = false;
    this._positioner = positioner;
  }

  startQuiz(options) {
    if (this._userStrokesIds) {
      this._renderState.run(removeAllUserStrokes(this._userStrokesIds));
    }

    this._userStrokesIds = [];
    this._isActive = true;
    this._options = options;
    const startIndex = fixIndex(options.quizStartStrokeNum, this._character.strokes.length);
    this._currentStrokeIndex = Math.min(startIndex, this._character.strokes.length - 1);
    this._mistakesOnStroke = 0;
    this._totalMistakes = 0;
    return this._renderState.run(startQuiz(this._character, options.strokeFadeDuration, this._currentStrokeIndex));
  }

  startUserStroke(externalPoint) {
    var _this$_userStrokesIds;

    if (!this._isActive) {
      return null;
    }

    if (this._userStroke) {
      return this.endUserStroke();
    }

    const point = this._positioner.convertExternalPoint(externalPoint);

    const strokeId = counter();
    this._userStroke = new UserStroke(strokeId, point, externalPoint);
    (_this$_userStrokesIds = this._userStrokesIds) === null || _this$_userStrokesIds === void 0 ? void 0 : _this$_userStrokesIds.push(strokeId);
    return this._renderState.run(startUserStroke(strokeId, point));
  }

  continueUserStroke(externalPoint) {
    if (!this._userStroke) {
      return Promise.resolve();
    }

    const point = this._positioner.convertExternalPoint(externalPoint);

    this._userStroke.appendPoint(point, externalPoint);

    const nextPoints = this._userStroke.points.slice(0);

    return this._renderState.run(updateUserStroke(this._userStroke.id, nextPoints));
  }

  setPositioner(positioner) {
    this._positioner = positioner;
  }

  endUserStroke() {
    var _this$_options$drawin;

    if (!this._userStroke) return;

    this._renderState.run(hideUserStroke(this._userStroke.id, (_this$_options$drawin = this._options.drawingFadeDuration) !== null && _this$_options$drawin !== void 0 ? _this$_options$drawin : 300)); // skip single-point strokes


    if (this._userStroke.points.length === 1) {
      this._userStroke = undefined;
      return;
    }

    const {
      acceptBackwardsStrokes,
      markStrokeCorrectAfterMisses
    } = this._options;

    const currentStroke = this._getCurrentStroke();

    const {
      isMatch,
      meta
    } = strokeMatches(this._userStroke, this._character, this._currentStrokeIndex, {
      isOutlineVisible: this._renderState.state.character.outline.opacity > 0,
      leniency: this._options.leniency,
      averageDistanceThreshold: this._options.averageDistanceThreshold
    }); // if markStrokeCorrectAfterMisses is passed, just force the stroke to count as correct after n tries

    const isForceAccepted = markStrokeCorrectAfterMisses && this._mistakesOnStroke + 1 >= markStrokeCorrectAfterMisses;
    const isAccepted = isMatch || isForceAccepted || meta.isStrokeBackwards && acceptBackwardsStrokes;

    if (isAccepted) {
      this._handleSuccess(meta);
    } else {
      this._handleFailure(meta);

      const {
        showHintAfterMisses,
        highlightColor,
        strokeHighlightSpeed
      } = this._options;

      if (showHintAfterMisses !== false && this._mistakesOnStroke >= showHintAfterMisses) {
        this._renderState.run(highlightStroke(currentStroke, colorStringToVals(highlightColor), strokeHighlightSpeed));
      }
    }

    this._userStroke = undefined;
  }

  cancel() {
    this._isActive = false;

    if (this._userStrokesIds) {
      this._renderState.run(removeAllUserStrokes(this._userStrokesIds));
    }
  }

  _getStrokeData({
    isCorrect,
    meta
  }) {
    return {
      character: this._character.symbol,
      strokeNum: this._currentStrokeIndex,
      mistakesOnStroke: this._mistakesOnStroke,
      totalMistakes: this._totalMistakes,
      strokesRemaining: this._character.strokes.length - this._currentStrokeIndex - (isCorrect ? 1 : 0),
      drawnPath: getDrawnPath(this._userStroke),
      isBackwards: meta.isStrokeBackwards
    };
  }

  nextStroke() {
    if (!this._options) return;
    const {
      strokes,
      symbol
    } = this._character;
    const {
      onComplete,
      highlightOnComplete,
      strokeFadeDuration,
      highlightCompleteColor,
      highlightColor,
      strokeHighlightDuration
    } = this._options;
    let animation = showStroke('main', this._currentStrokeIndex, strokeFadeDuration);
    this._mistakesOnStroke = 0;
    this._currentStrokeIndex += 1;
    const isComplete = this._currentStrokeIndex === strokes.length;

    if (isComplete) {
      this._isActive = false;
      onComplete === null || onComplete === void 0 ? void 0 : onComplete({
        character: symbol,
        totalMistakes: this._totalMistakes
      });

      if (highlightOnComplete) {
        animation = animation.concat(highlightCompleteChar(this._character, colorStringToVals(highlightCompleteColor || highlightColor), (strokeHighlightDuration || 0) * 2));
      }
    }

    this._renderState.run(animation);
  }

  _handleSuccess(meta) {
    if (!this._options) return;
    const {
      onCorrectStroke
    } = this._options;
    onCorrectStroke === null || onCorrectStroke === void 0 ? void 0 : onCorrectStroke({ ...this._getStrokeData({
        isCorrect: true,
        meta
      })
    });
    this.nextStroke();
  }

  _handleFailure(meta) {
    var _this$_options$onMist, _this$_options;

    this._mistakesOnStroke += 1;
    this._totalMistakes += 1;
    (_this$_options$onMist = (_this$_options = this._options).onMistake) === null || _this$_options$onMist === void 0 ? void 0 : _this$_options$onMist.call(_this$_options, this._getStrokeData({
      isCorrect: false,
      meta
    }));
  }

  _getCurrentStroke() {
    return this._character.strokes[this._currentStrokeIndex];
  }

}

function createElm(elmType) {
  return document.createElementNS('http://www.w3.org/2000/svg', elmType);
}
function attr(elm, name, value) {
  elm.setAttributeNS(null, name, value);
}
function attrs(elm, attrsMap) {
  Object.keys(attrsMap).forEach(attrName => attr(elm, attrName, attrsMap[attrName]));
} // inspired by https://talk.observablehq.com/t/hanzi-writer-renders-incorrectly-inside-an-observable-notebook-on-a-mobile-browser/1898

function urlIdRef(id) {
  let prefix = '';

  if (window.location && window.location.href) {
    prefix = window.location.href.replace(/#[^#]*$/, '').replace(/"/gi, '%22');
  }

  return `url("${prefix}#${id}")`;
}
function removeElm(elm) {
  var _elm$parentNode;

  elm === null || elm === void 0 ? void 0 : (_elm$parentNode = elm.parentNode) === null || _elm$parentNode === void 0 ? void 0 : _elm$parentNode.removeChild(elm);
}

class StrokeRendererBase {
  constructor(stroke) {
    this.stroke = stroke;
    this._pathLength = stroke.getLength() + StrokeRendererBase.STROKE_WIDTH / 2;
  }

  _getStrokeDashoffset(displayPortion) {
    return this._pathLength * 0.999 * (1 - displayPortion);
  }

  _getColor({
    strokeColor,
    radicalColor
  }) {
    return radicalColor && this.stroke.isInRadical ? radicalColor : strokeColor;
  }

}
StrokeRendererBase.STROKE_WIDTH = 200;

const STROKE_WIDTH = 200;
/** This is a stroke composed of several stroke parts **/

class StrokeRenderer extends StrokeRendererBase {
  constructor(stroke) {
    super(stroke);
    this._oldProps = undefined;
  }

  mount(target) {
    this._animationPath = createElm('path');
    this._clip = createElm('clipPath');
    this._strokePath = createElm('path');
    const maskId = `mask-${counter()}`;
    attr(this._clip, 'id', maskId);
    attr(this._strokePath, 'd', this.stroke.path);
    this._animationPath.style.opacity = '0';
    attr(this._animationPath, 'clip-path', urlIdRef(maskId));
    const extendedMaskPoints = extendStart(this.stroke.points, STROKE_WIDTH / 2);
    attr(this._animationPath, 'd', getPathString(extendedMaskPoints));
    attrs(this._animationPath, {
      stroke: '#FFFFFF',
      'stroke-width': STROKE_WIDTH.toString(),
      fill: 'none',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'miter',
      'stroke-dasharray': `${this._pathLength},${this._pathLength}`
    });

    this._clip.appendChild(this._strokePath);

    target.defs.appendChild(this._clip);
    target.svg.appendChild(this._animationPath);
    return this;
  }

  render(props) {
    var _this$_oldProps, _this$_oldProps2;

    if (props === this._oldProps || !this._animationPath) {
      return;
    }

    if (props.displayPortion !== ((_this$_oldProps = this._oldProps) === null || _this$_oldProps === void 0 ? void 0 : _this$_oldProps.displayPortion)) {
      this._animationPath.style.strokeDashoffset = this._getStrokeDashoffset(props.displayPortion).toString();
    }

    const color = this._getColor(props);

    if (!this._oldProps || color !== this._getColor(this._oldProps)) {
      const {
        r,
        g,
        b,
        a
      } = color;
      attrs(this._animationPath, {
        stroke: `rgba(${r},${g},${b},${a})`
      });
    }

    if (props.opacity !== ((_this$_oldProps2 = this._oldProps) === null || _this$_oldProps2 === void 0 ? void 0 : _this$_oldProps2.opacity)) {
      this._animationPath.style.opacity = props.opacity.toString();
    }

    this._oldProps = props;
  }

}

class CharacterRenderer {
  constructor(character) {
    this._oldProps = undefined;
    this._strokeRenderers = character.strokes.map(stroke => new StrokeRenderer(stroke));
  }

  mount(target) {
    const subTarget = target.createSubRenderTarget();
    this._group = subTarget.svg;

    this._strokeRenderers.forEach(strokeRenderer => {
      strokeRenderer.mount(subTarget);
    });
  }

  render(props) {
    var _this$_oldProps, _this$_oldProps3;

    if (props === this._oldProps || !this._group) {
      return;
    }

    const {
      opacity,
      strokes,
      strokeColor,
      radicalColor = null
    } = props;

    if (opacity !== ((_this$_oldProps = this._oldProps) === null || _this$_oldProps === void 0 ? void 0 : _this$_oldProps.opacity)) {
      this._group.style.opacity = opacity.toString(); // MS browsers seem to have a bug where if SVG is set to display:none, it sometimes breaks.
      // More info: https://github.com/chanind/hanzi-writer/issues/164
      // this is just a perf improvement, so disable for MS browsers

      if (!isMsBrowser) {
        var _this$_oldProps2;

        if (opacity === 0) {
          this._group.style.display = 'none';
        } else if (((_this$_oldProps2 = this._oldProps) === null || _this$_oldProps2 === void 0 ? void 0 : _this$_oldProps2.opacity) === 0) {
          this._group.style.removeProperty('display');
        }
      }
    }

    const colorsChanged = !this._oldProps || strokeColor !== this._oldProps.strokeColor || radicalColor !== this._oldProps.radicalColor;

    if (colorsChanged || strokes !== ((_this$_oldProps3 = this._oldProps) === null || _this$_oldProps3 === void 0 ? void 0 : _this$_oldProps3.strokes)) {
      for (let i = 0; i < this._strokeRenderers.length; i++) {
        var _this$_oldProps4;

        if (!colorsChanged && (_this$_oldProps4 = this._oldProps) !== null && _this$_oldProps4 !== void 0 && _this$_oldProps4.strokes && strokes[i] === this._oldProps.strokes[i]) {
          continue;
        }

        this._strokeRenderers[i].render({
          strokeColor,
          radicalColor,
          opacity: strokes[i].opacity,
          displayPortion: strokes[i].displayPortion
        });
      }
    }

    this._oldProps = props;
  }

}

class UserStrokeRenderer {
  constructor() {
    this._oldProps = undefined;
  }

  mount(target) {
    this._path = createElm('path');
    target.svg.appendChild(this._path);
  }

  render(props) {
    var _this$_oldProps, _this$_oldProps2, _this$_oldProps3, _this$_oldProps4;

    if (!this._path || props === this._oldProps) {
      return;
    }

    if (props.strokeColor !== ((_this$_oldProps = this._oldProps) === null || _this$_oldProps === void 0 ? void 0 : _this$_oldProps.strokeColor) || props.strokeWidth !== ((_this$_oldProps2 = this._oldProps) === null || _this$_oldProps2 === void 0 ? void 0 : _this$_oldProps2.strokeWidth)) {
      const {
        r,
        g,
        b,
        a
      } = props.strokeColor;
      attrs(this._path, {
        fill: 'none',
        stroke: `rgba(${r},${g},${b},${a})`,
        'stroke-width': props.strokeWidth.toString(),
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round'
      });
    }

    if (props.opacity !== ((_this$_oldProps3 = this._oldProps) === null || _this$_oldProps3 === void 0 ? void 0 : _this$_oldProps3.opacity)) {
      attr(this._path, 'opacity', props.opacity.toString());
    }

    if (props.points !== ((_this$_oldProps4 = this._oldProps) === null || _this$_oldProps4 === void 0 ? void 0 : _this$_oldProps4.points)) {
      attr(this._path, 'd', getPathString(props.points));
    }

    this._oldProps = props;
  }

  destroy() {
    removeElm(this._path);
  }

}

class HangulWriterRenderer {
  constructor(character, positioner) {
    this._character = character;
    this._positioner = positioner;
    this._mainCharRenderer = new CharacterRenderer(character);
    this._outlineCharRenderer = new CharacterRenderer(character);
    this._highlightCharRenderer = new CharacterRenderer(character);
    this._userStrokeRenderers = {};
  }

  mount(target) {
    const positionedTarget = target.createSubRenderTarget();
    const group = positionedTarget.svg;
    const {
      xOffset,
      yOffset,
      height,
      scale
    } = this._positioner;
    attr(group, 'transform', `translate(${xOffset}, ${height - yOffset}) scale(${scale}, ${-1 * scale})`);

    this._outlineCharRenderer.mount(positionedTarget);

    this._mainCharRenderer.mount(positionedTarget);

    this._highlightCharRenderer.mount(positionedTarget);

    this._positionedTarget = positionedTarget;
  }

  render(props) {
    const {
      main,
      outline,
      highlight
    } = props.character;
    const {
      outlineColor,
      radicalColor,
      highlightColor,
      strokeColor,
      drawingWidth,
      drawingColor
    } = props.options;

    this._outlineCharRenderer.render({
      opacity: outline.opacity,
      strokes: outline.strokes,
      strokeColor: outlineColor
    });

    this._mainCharRenderer.render({
      opacity: main.opacity,
      strokes: main.strokes,
      strokeColor,
      radicalColor: radicalColor
    });

    this._highlightCharRenderer.render({
      opacity: highlight.opacity,
      strokes: highlight.strokes,
      strokeColor: highlightColor
    });

    const userStrokes = props.userStrokes || {};

    for (const userStrokeId in this._userStrokeRenderers) {
      if (!userStrokes[userStrokeId]) {
        var _this$_userStrokeRend;

        (_this$_userStrokeRend = this._userStrokeRenderers[userStrokeId]) === null || _this$_userStrokeRend === void 0 ? void 0 : _this$_userStrokeRend.destroy();
        delete this._userStrokeRenderers[userStrokeId];
      }
    }

    for (const userStrokeId in userStrokes) {
      const stroke = userStrokes[userStrokeId];

      if (!stroke) {
        continue;
      }

      const userStrokeProps = {
        strokeWidth: drawingWidth,
        strokeColor: drawingColor,
        ...stroke
      };

      const strokeRenderer = (() => {
        if (this._userStrokeRenderers[userStrokeId]) {
          return this._userStrokeRenderers[userStrokeId];
        }

        const newStrokeRenderer = new UserStrokeRenderer();
        newStrokeRenderer.mount(this._positionedTarget);
        this._userStrokeRenderers[userStrokeId] = newStrokeRenderer;
        return newStrokeRenderer;
      })();

      strokeRenderer.render(userStrokeProps);
    }
  }

  destroy() {
    removeElm(this._positionedTarget.svg);
    this._positionedTarget.defs.innerHTML = '';
  }

}

/** Generic render target */
class RenderTargetBase {
  constructor(node) {
    this.node = node;
  }

  addPointerStartListener(callback) {
    this.node.addEventListener('mousedown', evt => {
      callback(this._eventify(evt, this._getMousePoint));
    });
    this.node.addEventListener('touchstart', evt => {
      callback(this._eventify(evt, this._getTouchPoint));
    });
  }

  addPointerMoveListener(callback) {
    this.node.addEventListener('mousemove', evt => {
      callback(this._eventify(evt, this._getMousePoint));
    });
    this.node.addEventListener('touchmove', evt => {
      callback(this._eventify(evt, this._getTouchPoint));
    });
  }

  addPointerEndListener(callback) {
    // TODO: find a way to not need global listeners
    document.addEventListener('mouseup', callback);
    document.addEventListener('touchend', callback);
  }

  getBoundingClientRect() {
    return this.node.getBoundingClientRect();
  }

  updateDimensions(width, height) {
    this.node.setAttribute('width', `${width}`);
    this.node.setAttribute('height', `${height}`);
  }

  _eventify(evt, pointFunc) {
    return {
      getPoint: () => pointFunc.call(this, evt),
      preventDefault: () => evt.preventDefault()
    };
  }

  _getMousePoint(evt) {
    const {
      left,
      top
    } = this.getBoundingClientRect();
    const x = evt.clientX - left;
    const y = evt.clientY - top;
    return {
      x,
      y
    };
  }

  _getTouchPoint(evt) {
    const {
      left,
      top
    } = this.getBoundingClientRect();
    const x = evt.touches[0].clientX - left;
    const y = evt.touches[0].clientY - top;
    return {
      x,
      y
    };
  }

}

class RenderTarget extends RenderTargetBase {
  constructor(svg, defs) {
    super(svg);
    this.svg = svg;
    this.defs = defs;

    if ('createSVGPoint' in svg) {
      this._pt = svg.createSVGPoint();
    }
  }

  static init(elmOrId, width = '100%', height = '100%') {
    const element = (() => {
      if (typeof elmOrId === 'string') {
        return document.getElementById(elmOrId);
      }

      return elmOrId;
    })();

    if (!element) {
      throw new Error(`HangulWriter target element not found: ${elmOrId}`);
    }

    const nodeType = element.nodeName.toUpperCase();

    const svg = (() => {
      if (nodeType === 'SVG' || nodeType === 'G') {
        return element;
      } else {
        const svg = createElm('svg');
        element.appendChild(svg);
        return svg;
      }
    })();

    attrs(svg, {
      width,
      height
    });
    const defs = createElm('defs');
    svg.appendChild(defs);
    return new RenderTarget(svg, defs);
  }

  createSubRenderTarget() {
    const group = createElm('g');
    this.svg.appendChild(group);
    return new RenderTarget(group, this.defs);
  }

  _getMousePoint(evt) {
    if (this._pt) {
      this._pt.x = evt.clientX;
      this._pt.y = evt.clientY;

      if ('getScreenCTM' in this.node) {
        var _this$node$getScreenC;

        const localPt = this._pt.matrixTransform((_this$node$getScreenC = this.node.getScreenCTM()) === null || _this$node$getScreenC === void 0 ? void 0 : _this$node$getScreenC.inverse());

        return {
          x: localPt.x,
          y: localPt.y
        };
      }
    }

    return super._getMousePoint.call(this, evt);
  }

  _getTouchPoint(evt) {
    if (this._pt) {
      this._pt.x = evt.touches[0].clientX;
      this._pt.y = evt.touches[0].clientY;

      if ('getScreenCTM' in this.node) {
        var _this$node$getScreenC2;

        const localPt = this._pt.matrixTransform((_this$node$getScreenC2 = this.node.getScreenCTM()) === null || _this$node$getScreenC2 === void 0 ? void 0 : _this$node$getScreenC2.inverse());

        return {
          x: localPt.x,
          y: localPt.y
        };
      }
    }

    return super._getTouchPoint(evt);
  }

}

var svgRenderer = {
  HangulWriterRenderer,
  createRenderTarget: RenderTarget.init
};

const drawPath = (ctx, points) => {
  ctx.beginPath();
  const start = points[0];
  const remainingPoints = points.slice(1);
  ctx.moveTo(start.x, start.y);

  for (const point of remainingPoints) {
    ctx.lineTo(point.x, point.y);
  }

  ctx.stroke();
};
/**
 * Break a path string into a series of canvas path commands
 *
 * Note: only works with the subset of SVG paths used by the character data
 * (absolute M, L, Q, C and Z commands)
 * @param pathString
 */

const pathStringToCanvas = pathString => {
  const pathParts = pathString.split(/(^|\s+)(?=[A-Z])/).filter(part => part !== ' ');
  const commands = [ctx => ctx.beginPath()];

  for (const part of pathParts) {
    const [cmd, ...rawParams] = part.split(/\s+/);
    const params = rawParams.map(param => parseFloat(param));

    if (cmd === 'M') {
      commands.push(ctx => ctx.moveTo(...params));
    } else if (cmd === 'L') {
      commands.push(ctx => ctx.lineTo(...params));
    } else if (cmd === 'C') {
      commands.push(ctx => ctx.bezierCurveTo(...params));
    } else if (cmd === 'Q') {
      commands.push(ctx => ctx.quadraticCurveTo(...params));
    } else ;
  }

  return ctx => commands.forEach(cmd => cmd(ctx));
};

/** this is a stroke composed of several stroke parts */

class StrokeRenderer$1 extends StrokeRendererBase {
  constructor(stroke, usePath2D = true) {
    super(stroke);

    if (usePath2D && Path2D) {
      this._path2D = new Path2D(this.stroke.path);
    } else {
      this._pathCmd = pathStringToCanvas(this.stroke.path);
    }

    this._extendedMaskPoints = extendStart(this.stroke.points, StrokeRendererBase.STROKE_WIDTH / 2);
  }

  render(ctx, props) {
    if (props.opacity < 0.05) {
      return;
    }

    ctx.save();

    if (this._path2D) {
      ctx.clip(this._path2D);
    } else {
      var _this$_pathCmd;

      (_this$_pathCmd = this._pathCmd) === null || _this$_pathCmd === void 0 ? void 0 : _this$_pathCmd.call(this, ctx); // wechat bugs out if the clip path isn't stroked or filled

      ctx.globalAlpha = 0;
      ctx.stroke();
      ctx.clip();
    }

    const {
      r,
      g,
      b,
      a
    } = this._getColor(props);

    const color = a === 1 ? `rgb(${r},${g},${b})` : `rgb(${r},${g},${b},${a})`;

    const dashOffset = this._getStrokeDashoffset(props.displayPortion);

    ctx.globalAlpha = props.opacity;
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = StrokeRendererBase.STROKE_WIDTH;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round'; // wechat sets dashOffset as a second param here. Should be harmless for browsers to add here too
    // @ts-ignore

    ctx.setLineDash([this._pathLength, this._pathLength], dashOffset);
    ctx.lineDashOffset = dashOffset;
    drawPath(ctx, this._extendedMaskPoints);
    ctx.restore();
  }

}

class CharacterRenderer$1 {
  constructor(character) {
    this._strokeRenderers = character.strokes.map(stroke => new StrokeRenderer$1(stroke));
  }

  render(ctx, props) {
    if (props.opacity < 0.05) return;
    const {
      opacity,
      strokeColor,
      radicalColor,
      strokes
    } = props;

    for (let i = 0; i < this._strokeRenderers.length; i++) {
      this._strokeRenderers[i].render(ctx, {
        strokeColor,
        radicalColor,
        opacity: strokes[i].opacity * opacity,
        displayPortion: strokes[i].displayPortion || 0
      });
    }
  }

}

function renderUserStroke(ctx, props) {
  if (props.opacity < 0.05) {
    return;
  }

  const {
    opacity,
    strokeWidth,
    strokeColor,
    points
  } = props;
  const {
    r,
    g,
    b,
    a
  } = strokeColor;
  ctx.save();
  ctx.globalAlpha = opacity;
  ctx.lineWidth = strokeWidth;
  ctx.strokeStyle = `rgba(${r},${g},${b},${a})`;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  drawPath(ctx, points);
  ctx.restore();
}

class HangulWriterRenderer$1 {
  constructor(character, positioner) {
    this.destroy = noop;
    this._character = character;
    this._positioner = positioner;
    this._mainCharRenderer = new CharacterRenderer$1(character);
    this._outlineCharRenderer = new CharacterRenderer$1(character);
    this._highlightCharRenderer = new CharacterRenderer$1(character);
  }

  mount(target) {
    this._target = target;
  }

  _animationFrame(cb) {
    const {
      width,
      height,
      scale,
      xOffset,
      yOffset
    } = this._positioner;

    const ctx = this._target.getContext();

    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.translate(xOffset, height - yOffset);
    ctx.transform(1, 0, 0, -1, 0, 0);
    ctx.scale(scale, scale);
    cb(ctx);
    ctx.restore(); // @ts-expect-error Verify if this is still needed for the "wechat miniprogram".

    if (ctx.draw) {
      // @ts-expect-error
      ctx.draw();
    }
  }

  render(props) {
    const {
      outline,
      main,
      highlight
    } = props.character;
    const {
      outlineColor,
      strokeColor,
      radicalColor,
      highlightColor,
      drawingColor,
      drawingWidth
    } = props.options;

    this._animationFrame(ctx => {
      this._outlineCharRenderer.render(ctx, {
        opacity: outline.opacity,
        strokes: outline.strokes,
        strokeColor: outlineColor
      });

      this._mainCharRenderer.render(ctx, {
        opacity: main.opacity,
        strokes: main.strokes,
        strokeColor: strokeColor,
        radicalColor: radicalColor
      });

      this._highlightCharRenderer.render(ctx, {
        opacity: highlight.opacity,
        strokes: highlight.strokes,
        strokeColor: highlightColor
      });

      const userStrokes = props.userStrokes || {};

      for (const userStrokeId in userStrokes) {
        const userStroke = userStrokes[userStrokeId];

        if (userStroke) {
          const userStrokeProps = {
            strokeWidth: drawingWidth,
            strokeColor: drawingColor,
            ...userStroke
          };
          renderUserStroke(ctx, userStrokeProps);
        }
      }
    });
  }

}

class RenderTarget$1 extends RenderTargetBase {
  constructor(canvas) {
    super(canvas);
  }

  static init(elmOrId, width = '100%', height = '100%') {
    const element = (() => {
      if (typeof elmOrId === 'string') {
        return document.getElementById(elmOrId);
      }

      return elmOrId;
    })();

    if (!element) {
      throw new Error(`HangulWriter target element not found: ${elmOrId}`);
    }

    const nodeType = element.nodeName.toUpperCase();

    const canvas = (() => {
      if (nodeType === 'CANVAS') {
        return element;
      }

      const canvas = document.createElement('canvas');
      element.appendChild(canvas);
      return canvas;
    })();

    canvas.setAttribute('width', width);
    canvas.setAttribute('height', height);
    return new RenderTarget$1(canvas);
  }

  getContext() {
    return this.node.getContext('2d');
  }

}

var canvasRenderer = {
  HangulWriterRenderer: HangulWriterRenderer$1,
  createRenderTarget: RenderTarget$1.init
};

const DEFAULT_STROKE_WIDTH = 80;
/** Caps miter joins at sharp corners, as a multiple of the half stroke width. */

const MAX_MITER = 3;
const MAX_MEDIAN_SPACING = 100;

const add = (a, b) => ({
  x: a.x + b.x,
  y: a.y + b.y
});

const sub = (a, b) => ({
  x: a.x - b.x,
  y: a.y - b.y
});

const scale = (a, s) => ({
  x: a.x * s,
  y: a.y * s
});

const dot = (a, b) => a.x * b.x + a.y * b.y;

const unit = a => scale(a, 1 / (Math.hypot(a.x, a.y) || 1));

const leftNormal = a => ({
  x: -a.y,
  y: a.x
});

const fmt = ({
  x,
  y
}) => `${Math.round(x)} ${Math.round(y)}`;
/**
 * Builds a closed SVG outline of constant width around a median, with mitered corners
 * and rounded caps. The median is guaranteed to lie inside the outline.
 */


function outlineFromMedian(median, strokeWidth = DEFAULT_STROKE_WIDTH) {
  if (median.length < 2) {
    throw new Error('A median needs at least two points');
  }

  const half = strokeWidth / 2;
  const points = median.map(([x, y]) => ({
    x,
    y
  }));
  const directions = points.slice(1).map((point, i) => unit(sub(point, points[i]))); // offset of the outline's left edge from each median point

  const offsets = points.map((_, i) => {
    if (i === 0) return scale(leftNormal(directions[0]), half);
    if (i === points.length - 1) return scale(leftNormal(directions[i - 1]), half);
    const before = leftNormal(directions[i - 1]);
    const after = leftNormal(directions[i]);
    const miter = unit(add(before, after));
    return scale(miter, half / Math.max(dot(miter, after), 1 / MAX_MITER));
  });
  const left = points.map((point, i) => add(point, offsets[i]));
  const right = points.map((point, i) => sub(point, offsets[i])); // rounded cap: two quadratic curves bulging `half` beyond the median's end

  const cap = (from, to, end, direction) => {
    const reach = scale(direction, half);
    return `Q ${fmt(add(from, reach))} ${fmt(add(end, reach))} Q ${fmt(add(to, reach))} ${fmt(to)}`;
  };

  const last = points.length - 1;
  const startDirection = scale(directions[0], -1);
  const endDirection = directions[last - 1];
  return [`M ${fmt(left[0])}`, ...left.slice(1).map(point => `L ${fmt(point)}`), cap(left[last], right[last], points[last], endDirection), ...right.slice(0, last).reverse().map(point => `L ${fmt(point)}`), cap(right[0], left[0], points[0], startDirection), 'Z'].join(' ');
}
/**
 * Inserts evenly spaced points so no two consecutive median points are further apart
 * than `maxSpacing`. Stroke matching measures distances to median *points*, and its
 * thresholds were tuned on data whose median points are typically 50–100 units apart.
 */

function densifyMedian(median, maxSpacing = MAX_MEDIAN_SPACING) {
  const dense = [median[0]];

  for (let i = 1; i < median.length; i++) {
    const [x0, y0] = median[i - 1];
    const [x1, y1] = median[i];
    const steps = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / maxSpacing));

    for (let s = 1; s <= steps; s++) {
      dense.push([Math.round(x0 + (x1 - x0) * s / steps), Math.round(y0 + (y1 - y0) * s / steps)]);
    }
  }

  return dense;
}
/**
 * Builds character data from hand-authored medians: generates each stroke's outline
 * and densifies the medians for stroke matching.
 */

function buildCharacterData(medians, strokeWidth = DEFAULT_STROKE_WIDTH) {
  return {
    strokes: medians.map(median => outlineFromMedian(median, strokeWidth)),
    medians: medians.map(median => densifyMedian(median))
  };
}
/**
 * Median for an elliptical stroke (e.g. ㅇ). Angles are in degrees; 90 is the top, and
 * increasing angles run counterclockwise as seen on screen.
 * The default sweep stops just short of a full turn, so the ends meet without the median doubling back.
 */

function ellipseMedian(cx, cy, rx, ry, {
  startAngle = 90,
  sweep = 355,
  segments = 36
} = {}) {
  return Array.from({
    length: segments + 1
  }, (_, i) => {
    const angle = (startAngle + sweep * i / segments) * Math.PI / 180;
    return [Math.round(cx + rx * Math.cos(angle)), Math.round(cy + ry * Math.sin(angle))];
  });
}

const getBounds = medians => {
  const points = medians.reduce((acc, median) => acc.concat(median), []);
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  return {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys)
  };
};
/**
 * Scales and moves medians so their bounding box fills `rect`. Each axis is scaled
 * independently, but one axis may be stretched at most `maxDistortion` times more than
 * the other (keeping e.g. ㅇ round); leftover space is split evenly. An axis without
 * extent (e.g. the width of ㅣ) is centred.
 * Also returns `scale`, the smaller of the two axis scales, i.e. how much the jamo shrank.
 */


function fitMedians(medians, rect, maxDistortion = Infinity) {
  const {
    minX,
    maxX,
    minY,
    maxY
  } = getBounds(medians);
  const width = maxX - minX;
  const height = maxY - minY;
  const rectWidth = rect.right - rect.left;
  const rectHeight = rect.top - rect.bottom;
  let scaleX = width > 0 ? rectWidth / width : NaN;
  let scaleY = height > 0 ? rectHeight / height : NaN;
  if (isNaN(scaleX)) scaleX = isNaN(scaleY) ? 1 : scaleY;
  if (isNaN(scaleY)) scaleY = scaleX;
  scaleX = Math.min(scaleX, scaleY * maxDistortion);
  scaleY = Math.min(scaleY, scaleX * maxDistortion);
  const offsetX = rect.left + (rectWidth - width * scaleX) / 2;
  const offsetY = rect.bottom + (rectHeight - height * scaleY) / 2;
  return {
    medians: medians.map(median => median.map(([x, y]) => [Math.round(offsetX + (x - minX) * scaleX), Math.round(offsetY + (y - minY) * scaleY)])),
    scale: Math.min(scaleX, scaleY)
  };
}
/**
 * Medians for two jamo squeezed horizontally side by side (e.g. ㄳ = ㄱ + ㅅ), left one
 * first. Each keeps its own height. `split` is the left jamo's share of the width.
 */

function sideBySideMedians(leftMedians, rightMedians, {
  left = 140,
  right = 884,
  gap = 100,
  split = 0.5
} = {}) {
  const available = right - left - gap;

  const squeezeInto = (medians, from, to) => {
    const {
      minY,
      maxY
    } = getBounds(medians);
    return fitMedians(medians, {
      left: from,
      right: to,
      bottom: minY,
      top: maxY
    }).medians;
  };

  const leftEnd = left + available * split;
  return squeezeInto(leftMedians, left, leftEnd).concat(squeezeInto(rightMedians, leftEnd + gap, right));
}
/** Medians for a doubled (tense) consonant such as ㄲ: two copies of the single one. */

function doubledMedians(medians, options) {
  return sideBySideMedians(medians, medians, options);
}

/** ㄱ (giyeok, U+3131): 1 stroke. */

var giyeok = buildCharacterData([// right, then down with a slight leftward sweep
[[200, 700], [780, 700], [780, 430], [770, 320], [748, 210], [705, 80]]]);

/** ㄴ (nieun, U+3134): 1 stroke. */

var nieun = buildCharacterData([// down, then right
[[240, 720], [240, 90], [820, 90]]]);

/** ㄷ (digeut, U+3137): 2 strokes. */

var digeut = buildCharacterData([// 1: top bar, left to right
[[220, 700], [800, 700]], // 2: ㄴ — down, then right
[[240, 700], [240, 90], [820, 90]]]);

/** ㄹ (rieul, U+3139): 3 strokes. */

var rieul = buildCharacterData([// 1: ㄱ — right, then down to the middle
[[220, 730], [780, 730], [780, 420]], // 2: middle bar, left to right
[[240, 420], [780, 420]], // 3: ㄴ — down, then right
[[240, 420], [240, 70], [820, 70]]]);

/** ㅁ (mieum, U+3141): 3 strokes. */

var mieum = buildCharacterData([// 1: left side, top to bottom
[[230, 700], [230, 80]], // 2: ㄱ — top, then right side down
[[230, 700], [790, 700], [790, 80]], // 3: bottom bar, left to right
[[230, 80], [790, 80]]]);

/** ㅂ (bieup, U+3142): 4 strokes. */

var bieup = buildCharacterData([// 1: left side, top to bottom
[[240, 730], [240, 70]], // 2: right side, top to bottom
[[780, 730], [780, 70]], // 3: middle bar, left to right
[[240, 400], [780, 400]], // 4: bottom bar, left to right
[[240, 70], [780, 70]]]);

/** ㅅ (siot, U+3145): 2 strokes, an inverted V. */

var siot = buildCharacterData([// 1: from the apex, falling to the lower left
[[512, 740], [470, 600], [390, 420], [290, 240], [180, 90]], // 2: from just below the apex, falling to the lower right
[[491, 670], [580, 480], [700, 290], [850, 90]]]);

/** ㅇ (ieung, U+3147): 1 stroke. */

var ieung = buildCharacterData([// circle from the top, counterclockwise
ellipseMedian(512, 400, 300, 255)]);

/** ㅈ (jieut, U+3148): 3 strokes, print form: a bar with ㅅ beneath. */

var jieut = buildCharacterData([// 1: top bar, left to right
[[220, 720], [800, 720]], // 2: from the middle of the bar, falling to the lower left
[[512, 720], [470, 580], [390, 400], [290, 230], [180, 80]], // 3: from just below the start of stroke 2, falling to the lower right
[[491, 650], [580, 470], [700, 280], [850, 80]]]);

/** ㅊ (chieut, U+314A): 4 strokes, print form: a short top stroke, a bar and ㅅ beneath. */

var chieut = buildCharacterData([// 1: short top stroke, left to right
[[430, 830], [600, 830]], // 2: bar, left to right
[[220, 670], [800, 670]], // 3: from the middle of the bar, falling to the lower left
[[512, 670], [470, 540], [390, 370], [290, 210], [180, 60]], // 4: from just below the start of stroke 3, falling to the lower right
[[491, 605], [580, 430], [700, 250], [850, 60]]]);

/** ㅋ (kieuk, U+314B): 2 strokes. */

var kieuk = buildCharacterData([// 1: ㄱ — right, then down with a slight leftward sweep
[[200, 710], [780, 710], [780, 430], [770, 320], [748, 210], [705, 80]], // 2: middle bar, left to right, rising slightly
[[230, 380], [750, 420]]]);

/** ㅌ (tieut, U+314C): 3 strokes. */

var tieut = buildCharacterData([// 1: top bar, left to right
[[220, 730], [800, 730]], // 2: middle bar, left to right
[[260, 410], [780, 410]], // 3: ㄴ — down, then right
[[240, 730], [240, 70], [820, 70]]]);

/** ㅍ (pieup, U+314D): 4 strokes. */

var pieup = buildCharacterData([// 1: top bar, left to right
[[200, 720], [820, 720]], // 2: left post, top to bottom
[[370, 720], [390, 100]], // 3: right post, top to bottom
[[650, 720], [630, 100]], // 4: bottom bar, left to right
[[180, 90], [840, 90]]]);

/** ㅎ (hieut, U+314E): 3 strokes. */

var hieut = buildCharacterData([// 1: short top bar, left to right
[[430, 830], [600, 830]], // 2: long bar, left to right
[[220, 690], [800, 690]], // 3: circle from the top, counterclockwise
ellipseMedian(512, 330, 230, 210)]);

/** ㅏ (a, U+314F): 2 strokes. */

var a = buildCharacterData([// 1: long vertical, top to bottom
[[440, 760], [440, 20]], // 2: short bar to the right
[[440, 420], [680, 420]]]);

/** ㅑ (ya, U+3151): 3 strokes. */

var ya = buildCharacterData([// 1: long vertical, top to bottom
[[420, 760], [420, 20]], // 2: upper short bar to the right
[[420, 530], [660, 530]], // 3: lower short bar to the right
[[420, 280], [660, 280]]]);

/** ㅓ (eo, U+3153): 2 strokes. */

var eo = buildCharacterData([// 1: short bar, left to right, meeting the vertical
[[340, 420], [580, 420]], // 2: long vertical, top to bottom
[[580, 760], [580, 20]]]);

/** ㅕ (yeo, U+3155): 3 strokes. */

var yeo = buildCharacterData([// 1: upper short bar, left to right
[[340, 530], [600, 530]], // 2: lower short bar, left to right
[[340, 280], [600, 280]], // 3: long vertical, top to bottom
[[600, 760], [600, 20]]]);

/** ㅗ (o, U+3157): 2 strokes. */

var o = buildCharacterData([// 1: short vertical, down onto the bar
[[512, 560], [512, 250]], // 2: long bar, left to right
[[180, 230], [840, 230]]]);

/** ㅛ (yo, U+315B): 3 strokes. */

var yo = buildCharacterData([// 1: left short vertical, down onto the bar
[[390, 560], [390, 250]], // 2: right short vertical, down onto the bar
[[634, 560], [634, 250]], // 3: long bar, left to right
[[180, 230], [840, 230]]]);

/** ㅜ (u, U+315C): 2 strokes. */

var u = buildCharacterData([// 1: long bar, left to right
[[180, 560], [840, 560]], // 2: short vertical, down from the bar
[[512, 560], [512, 150]]]);

/** ㅠ (yu, U+3160): 3 strokes. */

var yu = buildCharacterData([// 1: long bar, left to right
[[180, 560], [840, 560]], // 2: left short vertical, down from the bar
[[390, 560], [390, 150]], // 3: right short vertical, down from the bar
[[634, 560], [634, 150]]]);

/** ㅡ (eu, U+3161): 1 stroke. */

var eu = buildCharacterData([// long bar, left to right
[[180, 400], [840, 400]]]);

/** ㅣ (i, U+3163): 1 stroke. */

var i = buildCharacterData([// long vertical, top to bottom
[[512, 760], [512, 20]]]);

/** ㄲ (ssanggiyeok, U+3132): 2 strokes — two narrow copies of the single consonant, left first. */

var ssanggiyeok = buildCharacterData(doubledMedians(giyeok.medians));

/** ㄸ (ssangdigeut, U+3138): 4 strokes — two narrow copies of the single consonant, left first. */

var ssangdigeut = buildCharacterData(doubledMedians(digeut.medians));

/** ㅃ (ssangbieup, U+3143): 8 strokes — two narrow copies of the single consonant, left first. */

var ssangbieup = buildCharacterData( // wider gap than other doubles: ㅂ's verticals would otherwise sit too close to tell apart
doubledMedians(bieup.medians, {
  left: 100,
  right: 924,
  gap: 200
}));

/** ㅆ (ssangsiot, U+3146): 4 strokes — two narrow copies of the single consonant, left first. */

var ssangsiot = buildCharacterData(doubledMedians(siot.medians));

/** ㅉ (ssangjieut, U+3149): 4 strokes — two narrow copies of the single consonant, left first. */

var ssangjieut = buildCharacterData(doubledMedians(jieut.medians));

/** ㅐ (ae, U+3150): 3 strokes — ㅏ + ㅣ. */

var ae = buildCharacterData([// 1: left vertical, top to bottom
[[360, 760], [360, 20]], // 2: short bar from the left vertical to the right one
[[360, 420], [640, 420]], // 3: right vertical, top to bottom
[[640, 790], [640, -10]]]);

/** ㅒ (yae, U+3152): 4 strokes — ㅑ + ㅣ. */

var yae = buildCharacterData([// 1: left vertical, top to bottom
[[360, 760], [360, 20]], // 2: upper short bar, left to right
[[360, 530], [640, 530]], // 3: lower short bar, left to right
[[360, 280], [640, 280]], // 4: right vertical, top to bottom
[[640, 790], [640, -10]]]);

/** ㅔ (e, U+3154): 3 strokes — ㅓ + ㅣ. */

var e = buildCharacterData([// 1: short bar, left to right, meeting the left vertical
[[270, 420], [500, 420]], // 2: left vertical, top to bottom
[[500, 760], [500, 20]], // 3: right vertical, top to bottom
[[730, 790], [730, -10]]]);

/** ㅖ (ye, U+3156): 4 strokes — ㅕ + ㅣ. */

var ye = buildCharacterData([// 1: upper short bar, left to right
[[260, 530], [490, 530]], // 2: lower short bar, left to right
[[260, 280], [490, 280]], // 3: left vertical, top to bottom
[[490, 760], [490, 20]], // 4: right vertical, top to bottom
[[730, 790], [730, -10]]]);

/** ㅘ (wa, U+3158): 4 strokes — ㅗ + ㅏ. */

var wa = buildCharacterData([// 1: ㅗ short vertical, down onto the bar
[[340, 500], [340, 270]], // 2: ㅗ bar, left to right
[[110, 250], [640, 250]], // 3: ㅏ vertical, top to bottom
[[690, 800], [690, -10]], // 4: ㅏ short bar to the right
[[690, 420], [890, 420]]]);

/** ㅙ (wae, U+3159): 5 strokes — ㅗ + ㅐ. */

var wae = buildCharacterData([// 1: ㅗ short vertical, down onto the bar
[[290, 500], [290, 270]], // 2: ㅗ bar, left to right
[[80, 250], [540, 250]], // 3: ㅐ left vertical, top to bottom
[[590, 780], [590, 10]], // 4: ㅐ short bar between the verticals
[[590, 420], [800, 420]], // 5: ㅐ right vertical, top to bottom
[[800, 810], [800, -20]]]);

/** ㅚ (oe, U+315A): 3 strokes — ㅗ + ㅣ. */

var oe = buildCharacterData([// 1: ㅗ short vertical, down onto the bar
[[370, 500], [370, 270]], // 2: ㅗ bar, left to right
[[130, 250], [650, 250]], // 3: ㅣ vertical, top to bottom
[[720, 800], [720, -10]]]);

/** ㅝ (wo, U+315D): 4 strokes — ㅜ + ㅓ. */

var wo = buildCharacterData([// 1: ㅜ bar, left to right
[[90, 520], [560, 520]], // 2: ㅜ short vertical, down from the bar
[[320, 520], [320, 100]], // 3: ㅓ short bar, left to right, meeting the vertical
[[470, 320], [730, 320]], // 4: ㅓ vertical, top to bottom
[[730, 800], [730, -10]]]);

/** ㅞ (we, U+315E): 5 strokes — ㅜ + ㅔ. */

var we = buildCharacterData([// 1: ㅜ bar, left to right
[[70, 520], [470, 520]], // 2: ㅜ short vertical, down from the bar
[[270, 520], [270, 100]], // 3: ㅔ short bar, left to right, meeting the left vertical
[[400, 320], [600, 320]], // 4: ㅔ left vertical, top to bottom
[[600, 790], [600, 0]], // 5: ㅔ right vertical, top to bottom
[[810, 810], [810, -20]]]);

/** ㅟ (wi, U+315F): 3 strokes — ㅜ + ㅣ. */

var wi = buildCharacterData([// 1: ㅜ bar, left to right
[[120, 520], [630, 520]], // 2: ㅜ short vertical, down from the bar
[[375, 520], [375, 100]], // 3: ㅣ vertical, top to bottom
[[720, 800], [720, -10]]]);

/** ㅢ (ui, U+3162): 2 strokes — ㅡ + ㅣ. */

var ui = buildCharacterData([// 1: ㅡ bar, left to right
[[120, 380], [640, 380]], // 2: ㅣ vertical, top to bottom
[[730, 800], [730, -10]]]);

/** ㄳ (giyeoksiot, U+3133): consonant cluster, giyeok then siot side by side. */

var giyeoksiot = buildCharacterData(sideBySideMedians(giyeok.medians, siot.medians));

/** ㄵ (nieunjieut, U+3135): consonant cluster, nieun then jieut side by side. */

var nieunjieut = buildCharacterData(sideBySideMedians(nieun.medians, jieut.medians));

/** ㄶ (nieunhieut, U+3136): consonant cluster, nieun then hieut side by side. */

var nieunhieut = buildCharacterData(sideBySideMedians(nieun.medians, hieut.medians));

/** ㄺ (rieulgiyeok, U+313A): consonant cluster, rieul then giyeok side by side. */

var rieulgiyeok = buildCharacterData(sideBySideMedians(rieul.medians, giyeok.medians));

/** ㄻ (rieulmieum, U+313B): consonant cluster, rieul then mieum side by side. */

var rieulmieum = buildCharacterData(sideBySideMedians(rieul.medians, mieum.medians));

/** ㄼ (rieulbieup, U+313C): consonant cluster, rieul then bieup side by side. */

var rieulbieup = buildCharacterData(sideBySideMedians(rieul.medians, bieup.medians));

/** ㄽ (rieulsiot, U+313D): consonant cluster, rieul then siot side by side. */

var rieulsiot = buildCharacterData(sideBySideMedians(rieul.medians, siot.medians));

/** ㄾ (rieultieut, U+313E): consonant cluster, rieul then tieut side by side. */

var rieultieut = buildCharacterData(sideBySideMedians(rieul.medians, tieut.medians));

/** ㄿ (rieulpieup, U+313F): consonant cluster, rieul then pieup side by side. */

var rieulpieup = buildCharacterData( // ㅍ gets most of the width: at half width its two posts sit too close to tell apart
sideBySideMedians(rieul.medians, pieup.medians, {
  left: 100,
  right: 924,
  split: 0.38
}));

/** ㅀ (rieulhieut, U+3140): consonant cluster, rieul then hieut side by side. */

var rieulhieut = buildCharacterData(sideBySideMedians(rieul.medians, hieut.medians));

/** ㅄ (bieupsiot, U+3144): consonant cluster, bieup then siot side by side. */

var bieupsiot = buildCharacterData(sideBySideMedians(bieup.medians, siot.medians));

/**
 * Registry of bundled Hangul character data, keyed by the character itself.
 * Jamo use the Hangul Compatibility Jamo block (U+3130–U+318F), which is what keyboards produce.
 * To add a character: create a data module next to this file and register it here.
 */

const hangulCharData = {
  // basic consonants
  ㄱ: giyeok,
  ㄴ: nieun,
  ㄷ: digeut,
  ㄹ: rieul,
  ㅁ: mieum,
  ㅂ: bieup,
  ㅅ: siot,
  ㅇ: ieung,
  ㅈ: jieut,
  ㅊ: chieut,
  ㅋ: kieuk,
  ㅌ: tieut,
  ㅍ: pieup,
  ㅎ: hieut,
  // basic vowels
  ㅏ: a,
  ㅑ: ya,
  ㅓ: eo,
  ㅕ: yeo,
  ㅗ: o,
  ㅛ: yo,
  ㅜ: u,
  ㅠ: yu,
  ㅡ: eu,
  ㅣ: i,
  // double (tense) consonants
  ㄲ: ssanggiyeok,
  ㄸ: ssangdigeut,
  ㅃ: ssangbieup,
  ㅆ: ssangsiot,
  ㅉ: ssangjieut,
  // compound vowels
  ㅐ: ae,
  ㅒ: yae,
  ㅔ: e,
  ㅖ: ye,
  ㅘ: wa,
  ㅙ: wae,
  ㅚ: oe,
  ㅝ: wo,
  ㅞ: we,
  ㅟ: wi,
  ㅢ: ui,
  // consonant clusters (only used as final consonants)
  ㄳ: giyeoksiot,
  ㄵ: nieunjieut,
  ㄶ: nieunhieut,
  ㄺ: rieulgiyeok,
  ㄻ: rieulmieum,
  ㄼ: rieulbieup,
  ㄽ: rieulsiot,
  ㄾ: rieultieut,
  ㄿ: rieulpieup,
  ㅀ: rieulhieut,
  ㅄ: bieupsiot
};

const SYLLABLE_START = 0xac00;
const SYLLABLE_COUNT = 11172;
const VOWEL_COUNT = 21;
const FINAL_COUNT = 28;
const INITIALS = Array.from('ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ');
const VOWELS = Array.from('ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ');
const FINALS = [''].concat(Array.from('ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'));
/**
 * Stroke width at full jamo size. Each syllable uses one width, scaled down with its most
 * shrunken jamo so crowded blocks (e.g. 훑) get thinner strokes, as in real typefaces.
 */

const BASE_STROKE_WIDTH = 80;
const MIN_STROKE_WIDTH = 36;
const MAX_STROKE_WIDTH = 64;
/** How much more one axis of a jamo may be stretched than the other when fitted. */

const MAX_DISTORTION = 1.5;
/** Finals sit in a wide, flat strip, so they may be flattened further, except round ones. */

const FINAL_MAX_DISTORTION = 2.5;
const ROUND_JAMO = 'ㅇㅎ';
/** Splits a precomposed syllable (가–힣) into its jamo, or returns null for anything else. */

function decomposeSyllable(char) {
  const index = char.length === 1 ? char.charCodeAt(0) - SYLLABLE_START : -1;

  if (index < 0 || index >= SYLLABLE_COUNT) {
    return null;
  }

  return {
    initial: INITIALS[Math.floor(index / (VOWEL_COUNT * FINAL_COUNT))],
    vowel: VOWELS[Math.floor(index / FINAL_COUNT) % VOWEL_COUNT],
    final: FINALS[index % FINAL_COUNT] || null
  };
}
const VOWEL_SHAPES = {
  ㅏ: 'vertical',
  ㅑ: 'vertical',
  ㅓ: 'vertical',
  ㅕ: 'vertical',
  ㅣ: 'vertical',
  ㅐ: 'verticalWide',
  ㅒ: 'verticalWide',
  ㅔ: 'verticalWide',
  ㅖ: 'verticalWide',
  ㅗ: 'horizontal',
  ㅛ: 'horizontal',
  ㅜ: 'horizontal',
  ㅠ: 'horizontal',
  ㅡ: 'horizontal',
  ㅘ: 'mixed',
  ㅚ: 'mixed',
  ㅝ: 'mixed',
  ㅟ: 'mixed',
  ㅢ: 'mixed',
  ㅙ: 'mixedWide',
  ㅞ: 'mixedWide'
};
/** Mixed vowels are placed as two parts: the horizontal one below the initial, then the vertical one. */

const MIXED_VOWEL_PARTS = {
  ㅘ: ['ㅗ', 'ㅏ'],
  ㅙ: ['ㅗ', 'ㅐ'],
  ㅚ: ['ㅗ', 'ㅣ'],
  ㅝ: ['ㅜ', 'ㅓ'],
  ㅞ: ['ㅜ', 'ㅔ'],
  ㅟ: ['ㅜ', 'ㅣ'],
  ㅢ: ['ㅡ', 'ㅣ']
};
/** Finals made of two side-by-side consonants get a wider area. */

const WIDE_FINALS = 'ㄲㄳㄵㄶㄺㄻㄼㄽㄾㄿㅀㅄㅆ';

const rect = (left, right, bottom, top) => ({
  left,
  right,
  bottom,
  top
});

const LAYOUTS = {
  vertical: {
    open: {
      initial: rect(90, 470, 120, 780),
      vowel: [rect(590, 900, -60, 840)]
    },
    closed: {
      initial: rect(90, 470, 360, 800),
      vowel: [rect(590, 900, 290, 840)]
    }
  },
  verticalWide: {
    open: {
      initial: rect(90, 420, 120, 780),
      vowel: [rect(540, 920, -60, 840)]
    },
    closed: {
      initial: rect(90, 420, 360, 800),
      vowel: [rect(540, 920, 290, 840)]
    }
  },
  horizontal: {
    open: {
      initial: rect(170, 854, 450, 830),
      vowel: [rect(90, 934, -50, 330)]
    },
    closed: {
      initial: rect(190, 834, 580, 830),
      vowel: [rect(90, 934, 290, 460)]
    }
  },
  mixed: {
    open: {
      initial: rect(110, 560, 480, 830),
      vowel: [rect(90, 620, -40, 360), rect(740, 900, -60, 840)]
    },
    closed: {
      initial: rect(110, 560, 620, 830),
      vowel: [rect(90, 620, 290, 500), rect(740, 900, 290, 840)]
    }
  },
  mixedWide: {
    open: {
      initial: rect(100, 470, 480, 830),
      vowel: [rect(80, 540, -40, 360), rect(640, 930, -60, 840)]
    },
    closed: {
      initial: rect(100, 470, 620, 830),
      vowel: [rect(80, 540, 290, 500), rect(640, 930, 290, 840)]
    }
  }
};
const FINAL_AREA = rect(170, 854, -70, 170);
const WIDE_FINAL_AREA = rect(110, 914, -70, 170);
/**
 * Places a syllable's jamo in a block layout, in standard stroke order: initial, vowel,
 * then final. Returns null for non-syllables.
 */

function layoutSyllable(char, jamoData = hangulCharData) {
  const syllable = decomposeSyllable(char);

  if (!syllable) {
    return null;
  }

  const {
    initial,
    vowel,
    final
  } = syllable;
  const layout = LAYOUTS[VOWEL_SHAPES[vowel]][final ? 'closed' : 'open'];
  const parts = [];
  let minScale = 1;

  const place = (jamo, role, area, maxDistortion = MAX_DISTORTION) => {
    const fitted = fitMedians(jamoData[jamo].medians, area, maxDistortion);
    parts.push({
      jamo,
      role,
      medians: fitted.medians
    });
    minScale = Math.min(minScale, fitted.scale);
  };

  place(initial, 'initial', layout.initial);
  (MIXED_VOWEL_PARTS[vowel] || [vowel]).forEach((part, i) => place(part, 'vowel', layout.vowel[i]));

  if (final) {
    const area = WIDE_FINALS.includes(final) ? WIDE_FINAL_AREA : FINAL_AREA;
    const maxDistortion = ROUND_JAMO.includes(final) ? MAX_DISTORTION : FINAL_MAX_DISTORTION;
    place(final, 'final', area, maxDistortion);
  }

  const strokeWidth = Math.max(MIN_STROKE_WIDTH, Math.min(MAX_STROKE_WIDTH, Math.round(BASE_STROKE_WIDTH * minScale)));
  return {
    parts,
    strokeWidth
  };
}
/** Builds stroke data for a precomposed syllable (가–힣), or returns null for anything else. */

function composeSyllable(char, jamoData = hangulCharData) {
  const layout = layoutSyllable(char, jamoData);

  if (!layout) {
    return null;
  }

  const medians = layout.parts.reduce((acc, part) => acc.concat(part.medians), []);
  return buildCharacterData(medians, layout.strokeWidth);
}

/**
 * Serves bundled jamo data and composes syllables (가–힣) on demand.
 * This is the default `charDataLoader`; pass your own to load other data.
 */

const hangulCharDataLoader = (char, onLoad, onError) => {
  const data = hangulCharData[char] || composeSyllable(char);

  if (data) {
    onLoad(data);
  } else {
    onError(new Error(`No Hangul character data for "${char}"`));
  }
};

const defaultOptions = {
  charDataLoader: hangulCharDataLoader,
  onLoadCharDataError: null,
  onLoadCharDataSuccess: null,
  showOutline: true,
  showCharacter: true,
  renderer: 'svg',
  // positioning options
  width: 0,
  height: 0,
  padding: 20,
  // animation options
  strokeAnimationSpeed: 1,
  strokeFadeDuration: 400,
  strokeHighlightDuration: 200,
  strokeHighlightSpeed: 2,
  delayBetweenStrokes: 1000,
  delayBetweenLoops: 2000,
  // colors
  strokeColor: '#555',
  radicalColor: null,
  highlightColor: '#AAF',
  outlineColor: '#DDD',
  drawingColor: '#333',
  // quiz options
  leniency: 1,
  showHintAfterMisses: 3,
  highlightOnComplete: true,
  highlightCompleteColor: null,
  markStrokeCorrectAfterMisses: false,
  acceptBackwardsStrokes: false,
  quizStartStrokeNum: 0,
  averageDistanceThreshold: 350,
  // undocumented obscure options
  drawingFadeDuration: 300,
  drawingWidth: 4,
  strokeWidth: 2,
  outlineWidth: 2,
  rendererOverride: {}
};

class LoadingManager {
  constructor(options) {
    this._loadCounter = 0;
    this._isLoading = false;
    /** use this to attribute to determine if there was a problem with loading */

    this.loadingFailed = false;
    this._options = options;
  }

  _debouncedLoad(char, count) {
    // these wrappers ignore all responses except the most recent.
    const wrappedResolve = data => {
      if (count === this._loadCounter) {
        var _this$_resolve;

        (_this$_resolve = this._resolve) === null || _this$_resolve === void 0 ? void 0 : _this$_resolve.call(this, data);
      }
    };

    const wrappedReject = reason => {
      if (count === this._loadCounter) {
        var _this$_reject;

        (_this$_reject = this._reject) === null || _this$_reject === void 0 ? void 0 : _this$_reject.call(this, reason);
      }
    };

    const returnedData = this._options.charDataLoader(char, wrappedResolve, wrappedReject);

    if (returnedData) {
      if ('then' in returnedData) {
        returnedData.then(wrappedResolve).catch(wrappedReject);
      } else {
        wrappedResolve(returnedData);
      }
    }
  }

  _setupLoadingPromise() {
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
    }).then(data => {
      var _this$_options$onLoad, _this$_options;

      this._isLoading = false;
      (_this$_options$onLoad = (_this$_options = this._options).onLoadCharDataSuccess) === null || _this$_options$onLoad === void 0 ? void 0 : _this$_options$onLoad.call(_this$_options, data);
      return data;
    }).catch(reason => {
      this._isLoading = false;
      this.loadingFailed = true; // If the user has provided an "onLoadCharDataError", call this function
      // Otherwise, throw the promise

      if (this._options.onLoadCharDataError) {
        this._options.onLoadCharDataError(reason);

        return;
      } // If error callback wasn't provided, throw an error so the developer will be aware something went wrong


      if (reason instanceof Error) {
        throw reason;
      }

      const err = new Error(`Failed to load char data for ${this._loadingChar}`);
      err.reason = reason;
      throw err;
    });
  }

  loadCharData(char) {
    this._loadingChar = char;

    const promise = this._setupLoadingPromise();

    this.loadingFailed = false;
    this._isLoading = true;
    this._loadCounter++;

    this._debouncedLoad(char, this._loadCounter);

    return promise;
  }

}

class HangulWriter {
  constructor(element, options = {}) {
    const {
      HangulWriterRenderer,
      createRenderTarget
    } = options.renderer === 'canvas' ? canvasRenderer : svgRenderer;
    const rendererOverride = options.rendererOverride || {};
    this._renderer = {
      HangulWriterRenderer: rendererOverride.HangulWriterRenderer || HangulWriterRenderer,
      createRenderTarget: rendererOverride.createRenderTarget || createRenderTarget
    }; // wechat miniprogram component needs direct access to the render target, so this is public

    this.target = this._renderer.createRenderTarget(element, options.width, options.height);
    this._options = this._assignOptions(options);
    this._loadingManager = new LoadingManager(this._options);

    this._setupListeners();
  }
  /** Main entry point */


  static create(element, character, options) {
    const writer = new HangulWriter(element, options);
    writer.setCharacter(character);
    return writer;
  }

  static loadCharacterData(character, options = {}) {
    const loadingManager = (() => {
      const {
        _loadingManager,
        _loadingOptions
      } = HangulWriter;

      if ((_loadingManager === null || _loadingManager === void 0 ? void 0 : _loadingManager._loadingChar) === character && _loadingOptions === options) {
        return _loadingManager;
      }

      return new LoadingManager({ ...defaultOptions,
        ...options
      });
    })();

    HangulWriter._loadingManager = loadingManager;
    HangulWriter._loadingOptions = options;
    return loadingManager.loadCharData(character);
  }

  static getScalingTransform(width, height, padding = 0) {
    const positioner = new Positioner({
      width,
      height,
      padding
    });
    return {
      x: positioner.xOffset,
      y: positioner.yOffset,
      scale: positioner.scale,
      transform: trim(`
        translate(${positioner.xOffset}, ${positioner.height - positioner.yOffset})
        scale(${positioner.scale}, ${-1 * positioner.scale})
      `).replace(/\s+/g, ' ')
    };
  }

  showCharacter(options = {}) {
    this._options.showCharacter = true;
    return this._withData(() => {
      var _this$_renderState;

      return (_this$_renderState = this._renderState) === null || _this$_renderState === void 0 ? void 0 : _this$_renderState.run(showCharacter('main', this._character, typeof options.duration === 'number' ? options.duration : this._options.strokeFadeDuration)).then(res => {
        var _options$onComplete;

        (_options$onComplete = options.onComplete) === null || _options$onComplete === void 0 ? void 0 : _options$onComplete.call(options, res);
        return res;
      });
    });
  }

  hideCharacter(options = {}) {
    this._options.showCharacter = false;
    return this._withData(() => {
      var _this$_renderState2;

      return (_this$_renderState2 = this._renderState) === null || _this$_renderState2 === void 0 ? void 0 : _this$_renderState2.run(hideCharacter('main', this._character, typeof options.duration === 'number' ? options.duration : this._options.strokeFadeDuration)).then(res => {
        var _options$onComplete2;

        (_options$onComplete2 = options.onComplete) === null || _options$onComplete2 === void 0 ? void 0 : _options$onComplete2.call(options, res);
        return res;
      });
    });
  }

  animateCharacter(options = {}) {
    this.cancelQuiz();
    return this._withData(() => {
      var _this$_renderState3;

      return (_this$_renderState3 = this._renderState) === null || _this$_renderState3 === void 0 ? void 0 : _this$_renderState3.run(animateCharacter('main', this._character, this._options.strokeFadeDuration, this._options.strokeAnimationSpeed, this._options.delayBetweenStrokes)).then(res => {
        var _options$onComplete3;

        (_options$onComplete3 = options.onComplete) === null || _options$onComplete3 === void 0 ? void 0 : _options$onComplete3.call(options, res);
        return res;
      });
    });
  }

  animateStroke(strokeNum, options = {}) {
    this.cancelQuiz();
    return this._withData(() => {
      var _this$_renderState4;

      return (_this$_renderState4 = this._renderState) === null || _this$_renderState4 === void 0 ? void 0 : _this$_renderState4.run(animateSingleStroke('main', this._character, fixIndex(strokeNum, this._character.strokes.length), this._options.strokeAnimationSpeed)).then(res => {
        var _options$onComplete4;

        (_options$onComplete4 = options.onComplete) === null || _options$onComplete4 === void 0 ? void 0 : _options$onComplete4.call(options, res);
        return res;
      });
    });
  }

  highlightStroke(strokeNum, options = {}) {
    const promise = () => {
      if (!this._character || !this._renderState) {
        return;
      }

      return this._renderState.run(highlightStroke(selectIndex(this._character.strokes, strokeNum), colorStringToVals(this._options.highlightColor), this._options.strokeHighlightSpeed)).then(res => {
        var _options$onComplete5;

        (_options$onComplete5 = options.onComplete) === null || _options$onComplete5 === void 0 ? void 0 : _options$onComplete5.call(options, res);
        return res;
      });
    };

    return this._withData(promise);
  }

  async loopCharacterAnimation() {
    this.cancelQuiz();
    return this._withData(() => this._renderState.run(animateCharacterLoop('main', this._character, this._options.strokeFadeDuration, this._options.strokeAnimationSpeed, this._options.delayBetweenStrokes, this._options.delayBetweenLoops), {
      loop: true
    }));
  }

  pauseAnimation() {
    return this._withData(() => {
      var _this$_renderState5;

      return (_this$_renderState5 = this._renderState) === null || _this$_renderState5 === void 0 ? void 0 : _this$_renderState5.pauseAll();
    });
  }

  resumeAnimation() {
    return this._withData(() => {
      var _this$_renderState6;

      return (_this$_renderState6 = this._renderState) === null || _this$_renderState6 === void 0 ? void 0 : _this$_renderState6.resumeAll();
    });
  }

  showOutline(options = {}) {
    this._options.showOutline = true;
    return this._withData(() => {
      var _this$_renderState7;

      return (_this$_renderState7 = this._renderState) === null || _this$_renderState7 === void 0 ? void 0 : _this$_renderState7.run(showCharacter('outline', this._character, typeof options.duration === 'number' ? options.duration : this._options.strokeFadeDuration)).then(res => {
        var _options$onComplete6;

        (_options$onComplete6 = options.onComplete) === null || _options$onComplete6 === void 0 ? void 0 : _options$onComplete6.call(options, res);
        return res;
      });
    });
  }

  hideOutline(options = {}) {
    this._options.showOutline = false;
    return this._withData(() => {
      var _this$_renderState8;

      return (_this$_renderState8 = this._renderState) === null || _this$_renderState8 === void 0 ? void 0 : _this$_renderState8.run(hideCharacter('outline', this._character, typeof options.duration === 'number' ? options.duration : this._options.strokeFadeDuration)).then(res => {
        var _options$onComplete7;

        (_options$onComplete7 = options.onComplete) === null || _options$onComplete7 === void 0 ? void 0 : _options$onComplete7.call(options, res);
        return res;
      });
    });
  }
  /** Updates the size of the writer instance without resetting render state */


  updateDimensions({
    width,
    height,
    padding
  }) {
    if (width !== undefined) this._options.width = width;
    if (height !== undefined) this._options.height = height;
    if (padding !== undefined) this._options.padding = padding;
    this.target.updateDimensions(this._options.width, this._options.height); // if there's already a character drawn, destroy and recreate the renderer in the same state

    if (this._character && this._renderState && this._hangulWriterRenderer && this._positioner) {
      this._hangulWriterRenderer.destroy();

      const hangulWriterRenderer = this._initAndMountHangulWriterRenderer(this._character); // TODO: this should probably implement EventEmitter instead of manually tracking updates like this


      this._renderState.overwriteOnStateChange(nextState => hangulWriterRenderer.render(nextState));

      hangulWriterRenderer.render(this._renderState.state); // update the current quiz as well, if one is active

      if (this._quiz) {
        this._quiz.setPositioner(this._positioner);
      }
    }
  }

  updateColor(colorName, colorVal, options = {}) {
    var _options$duration;

    let mutations = [];

    const fixedColorVal = (() => {
      // If we're removing radical color, tween it to the stroke color
      if (colorName === 'radicalColor' && !colorVal) {
        return this._options.strokeColor;
      }

      return colorVal;
    })();

    const mappedColor = colorStringToVals(fixedColorVal);
    this._options[colorName] = colorVal;
    const duration = (_options$duration = options.duration) !== null && _options$duration !== void 0 ? _options$duration : this._options.strokeFadeDuration;
    mutations = mutations.concat(updateColor(colorName, mappedColor, duration)); // make sure to set radicalColor back to null after the transition finishes if val == null

    if (colorName === 'radicalColor' && !colorVal) {
      mutations = mutations.concat(updateColor(colorName, null, 0));
    }

    return this._withData(() => {
      var _this$_renderState9;

      return (_this$_renderState9 = this._renderState) === null || _this$_renderState9 === void 0 ? void 0 : _this$_renderState9.run(mutations).then(res => {
        var _options$onComplete8;

        (_options$onComplete8 = options.onComplete) === null || _options$onComplete8 === void 0 ? void 0 : _options$onComplete8.call(options, res);
        return res;
      });
    });
  }

  quiz(quizOptions = {}) {
    return this._withData(async () => {
      if (this._character && this._renderState && this._positioner) {
        this.cancelQuiz();
        this._quiz = new Quiz(this._character, this._renderState, this._positioner);
        this._options = { ...this._options,
          ...quizOptions
        };

        this._quiz.startQuiz(this._options);
      }
    });
  }

  skipQuizStroke() {
    if (this._quiz) {
      this._quiz.nextStroke();
    }
  }

  cancelQuiz() {
    if (this._quiz) {
      this._quiz.cancel();

      this._quiz = undefined;
    }
  }

  setCharacter(char) {
    this.cancelQuiz();
    this._char = char;

    if (this._hangulWriterRenderer) {
      this._hangulWriterRenderer.destroy();
    }

    if (this._renderState) {
      this._renderState.cancelAll();
    }

    this._hangulWriterRenderer = null;
    this._withDataPromise = this._loadingManager.loadCharData(char).then(pathStrings => {
      // if "pathStrings" isn't set, ".catch()"" was probably called and loading likely failed
      if (!pathStrings || this._loadingManager.loadingFailed) {
        return;
      }

      this._character = parseCharData(char, pathStrings);
      this._renderState = new RenderState(this._character, this._options, nextState => hangulWriterRenderer.render(nextState));

      const hangulWriterRenderer = this._initAndMountHangulWriterRenderer(this._character);

      hangulWriterRenderer.render(this._renderState.state);
    });
    return this._withDataPromise;
  }

  _initAndMountHangulWriterRenderer(character) {
    const {
      width,
      height,
      padding
    } = this._options;
    this._positioner = new Positioner({
      width,
      height,
      padding
    });
    const hangulWriterRenderer = new this._renderer.HangulWriterRenderer(character, this._positioner);
    hangulWriterRenderer.mount(this.target);
    this._hangulWriterRenderer = hangulWriterRenderer;
    return hangulWriterRenderer;
  }

  async getCharacterData() {
    if (!this._char) {
      throw new Error('setCharacter() must be called before calling getCharacterData()');
    }

    const character = await this._withData(() => this._character);
    return character;
  }

  _assignOptions(options) {
    const mergedOptions = { ...defaultOptions,
      ...options
    }; // backfill strokeAnimationSpeed if deprecated strokeAnimationDuration is provided instead

    if (options.strokeAnimationDuration && !options.strokeAnimationSpeed) {
      mergedOptions.strokeAnimationSpeed = 500 / options.strokeAnimationDuration;
    }

    if (options.strokeHighlightDuration && !options.strokeHighlightSpeed) {
      mergedOptions.strokeHighlightSpeed = 500 / mergedOptions.strokeHighlightDuration;
    }

    if (!options.highlightCompleteColor) {
      mergedOptions.highlightCompleteColor = mergedOptions.highlightColor;
    }

    return this._fillWidthAndHeight(mergedOptions);
  }
  /** returns a new options object with width and height filled in if missing */


  _fillWidthAndHeight(options) {
    const filledOpts = { ...options
    };

    if (filledOpts.width && !filledOpts.height) {
      filledOpts.height = filledOpts.width;
    } else if (filledOpts.height && !filledOpts.width) {
      filledOpts.width = filledOpts.height;
    } else if (!filledOpts.width && !filledOpts.height) {
      const {
        width,
        height
      } = this.target.getBoundingClientRect();
      const minDim = Math.min(width, height);
      filledOpts.width = minDim;
      filledOpts.height = minDim;
    }

    return filledOpts;
  }

  _withData(func) {
    // if this._loadingManager.loadingFailed, then loading failed before this method was called
    if (this._loadingManager.loadingFailed) {
      throw Error('Failed to load character data. Call setCharacter and try again.');
    }

    if (this._withDataPromise) {
      return this._withDataPromise.then(() => {
        if (!this._loadingManager.loadingFailed) {
          return func();
        }
      });
    }

    return Promise.resolve().then(func);
  }

  _setupListeners() {
    this.target.addPointerStartListener(evt => {
      if (this._quiz) {
        evt.preventDefault();

        this._quiz.startUserStroke(evt.getPoint());
      }
    });
    this.target.addPointerMoveListener(evt => {
      if (this._quiz) {
        evt.preventDefault();

        this._quiz.continueUserStroke(evt.getPoint());
      }
    });
    this.target.addPointerEndListener(() => {
      var _this$_quiz;

      (_this$_quiz = this._quiz) === null || _this$_quiz === void 0 ? void 0 : _this$_quiz.endUserStroke();
    });
  }

}
/** Singleton instance of LoadingManager. Only set in `loadCharacterData` */

HangulWriter._loadingManager = null;
/** Singleton loading options. Only set in `loadCharacterData` */

HangulWriter._loadingOptions = null;

export default HangulWriter;
//# sourceMappingURL=index.esm.js.map
