// Lightweight Machine Learning Core for TypeScript
// Implements Logistic Regression, Decision Trees, Random Forest, and Gradient Boosting

export type Vector = number[];
export type Matrix = Vector[];

// ---------------------------------------------------------
// Logistic Regression
// ---------------------------------------------------------
export class LogisticRegression {
  weights: Vector = [];
  bias: number = 0;
  learningRate: number;
  epochs: number;

  constructor(learningRate: number = 0.01, epochs: number = 100) {
    this.learningRate = learningRate;
    this.epochs = epochs;
  }

  private sigmoid(z: number): number {
    return 1 / (1 + Math.exp(-z));
  }

  train(X: Matrix, y: Vector) {
    const numSamples = X.length;
    const numFeatures = X[0].length;
    this.weights = new Array(numFeatures).fill(0);
    this.bias = 0;

    for (let epoch = 0; epoch < this.epochs; epoch++) {
      for (let i = 0; i < numSamples; i++) {
        let z = this.bias;
        for (let j = 0; j < numFeatures; j++) {
          z += X[i][j] * this.weights[j];
        }
        const prediction = this.sigmoid(z);
        const error = prediction - y[i];

        this.bias -= this.learningRate * error;
        for (let j = 0; j < numFeatures; j++) {
          this.weights[j] -= this.learningRate * error * X[i][j];
        }
      }
    }
  }

  predictProba(x: Vector): number {
    let z = this.bias;
    for (let j = 0; j < x.length; j++) {
      z += x[j] * this.weights[j];
    }
    return this.sigmoid(z);
  }
}

// ---------------------------------------------------------
// Decision Tree
// ---------------------------------------------------------
interface TreeNode {
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
  value?: number; // Leaf prediction value
}

export class DecisionTree {
  root?: TreeNode;
  maxDepth: number;
  minSamplesSplit: number;
  isRegressor: boolean; // GB uses regression trees
  featureImportance: number[];

  constructor(maxDepth: number = 5, minSamplesSplit: number = 2, isRegressor: boolean = false) {
    this.maxDepth = maxDepth;
    this.minSamplesSplit = minSamplesSplit;
    this.isRegressor = isRegressor;
    this.featureImportance = [];
  }

  train(X: Matrix, y: Vector) {
    this.featureImportance = new Array(X[0].length).fill(0);
    this.root = this.buildTree(X, y, 0);
  }

  private buildTree(X: Matrix, y: Vector, depth: number): TreeNode {
    const numSamples = X.length;
    const numFeatures = X[0].length;

    if (depth >= this.maxDepth || numSamples < this.minSamplesSplit || new Set(y).size === 1) {
      return { value: this.calculateLeafValue(y) };
    }

    let bestSplit = this.getBestSplit(X, y, numFeatures);

    if (bestSplit.gain > 0) {
      this.featureImportance[bestSplit.featureIndex] += bestSplit.gain;
      const leftSubtree = this.buildTree(bestSplit.leftX, bestSplit.leftY, depth + 1);
      const rightSubtree = this.buildTree(bestSplit.rightX, bestSplit.rightY, depth + 1);
      return {
        featureIndex: bestSplit.featureIndex,
        threshold: bestSplit.threshold,
        left: leftSubtree,
        right: rightSubtree
      };
    }

    return { value: this.calculateLeafValue(y) };
  }

  private getBestSplit(X: Matrix, y: Vector, numFeatures: number) {
    let bestSplit = { gain: -1, featureIndex: -1, threshold: 0, leftX: [] as Matrix, leftY: [] as Vector, rightX: [] as Matrix, rightY: [] as Vector };
    
    // Subsample features for Random Forest if needed
    for (let featureIndex = 0; featureIndex < numFeatures; featureIndex++) {
      const featureValues = Array.from(new Set(X.map(row => row[featureIndex]))).sort((a,b)=>a-b);
      // Try thresholds
      for (let i = 0; i < featureValues.length - 1; i++) {
        const threshold = (featureValues[i] + featureValues[i+1]) / 2;
        const { leftX, leftY, rightX, rightY } = this.split(X, y, featureIndex, threshold);
        
        if (leftY.length > 0 && rightY.length > 0) {
          const gain = this.calculateGain(y, leftY, rightY);
          if (gain > bestSplit.gain) {
            bestSplit = { gain, featureIndex, threshold, leftX, leftY, rightX, rightY };
          }
        }
      }
    }
    return bestSplit;
  }

  private split(X: Matrix, y: Vector, featureIndex: number, threshold: number) {
    const leftX: Matrix = [], leftY: Vector = [], rightX: Matrix = [], rightY: Vector = [];
    for (let i = 0; i < X.length; i++) {
      if (X[i][featureIndex] <= threshold) {
        leftX.push(X[i]); leftY.push(y[i]);
      } else {
        rightX.push(X[i]); rightY.push(y[i]);
      }
    }
    return { leftX, leftY, rightX, rightY };
  }

  private calculateGain(parentY: Vector, leftY: Vector, rightY: Vector): number {
    const weightL = leftY.length / parentY.length;
    const weightR = rightY.length / parentY.length;
    if (this.isRegressor) {
      return this.variance(parentY) - (weightL * this.variance(leftY) + weightR * this.variance(rightY));
    } else {
      return this.gini(parentY) - (weightL * this.gini(leftY) + weightR * this.gini(rightY));
    }
  }

  private gini(y: Vector): number {
    const ones = y.filter(val => val === 1).length;
    const zeros = y.length - ones;
    const p1 = ones / y.length;
    const p0 = zeros / y.length;
    return 1 - (p1*p1 + p0*p0);
  }

  private variance(y: Vector): number {
    const mean = y.reduce((a,b)=>a+b,0) / y.length;
    return y.reduce((a,b)=>a+Math.pow(b-mean,2),0) / y.length;
  }

  private calculateLeafValue(y: Vector): number {
    if (this.isRegressor) {
      return y.reduce((a,b)=>a+b,0) / y.length;
    } else {
      const ones = y.filter(val => val === 1).length;
      return ones >= y.length / 2 ? 1 : 0;
    }
  }

  predict(x: Vector): number {
    let node = this.root!;
    while (node.value === undefined) {
      if (x[node.featureIndex!] <= node.threshold!) {
        node = node.left!;
      } else {
        node = node.right!;
      }
    }
    return node.value;
  }
}

// ---------------------------------------------------------
// Random Forest
// ---------------------------------------------------------
export class RandomForest {
  trees: DecisionTree[] = [];
  numTrees: number;
  maxDepth: number;
  featureImportance: number[] = [];

  constructor(numTrees: number = 10, maxDepth: number = 5) {
    this.numTrees = numTrees;
    this.maxDepth = maxDepth;
  }

  train(X: Matrix, y: Vector) {
    this.trees = [];
    this.featureImportance = new Array(X[0].length).fill(0);
    
    for (let i = 0; i < this.numTrees; i++) {
      const tree = new DecisionTree(this.maxDepth, 2, false);
      // Bootstrap sample
      const sampleX: Matrix = [];
      const sampleY: Vector = [];
      for (let j = 0; j < X.length; j++) {
        const r = Math.floor(Math.random() * X.length);
        sampleX.push(X[r]);
        sampleY.push(y[r]);
      }
      tree.train(sampleX, sampleY);
      this.trees.push(tree);

      // Aggregate importance
      tree.featureImportance.forEach((val, idx) => {
        this.featureImportance[idx] += val;
      });
    }
    
    // Normalize importance
    const sum = this.featureImportance.reduce((a,b)=>a+b, 0) || 1;
    this.featureImportance = this.featureImportance.map(v => v / sum);
  }

  predictProba(x: Vector): number {
    let sum = 0;
    for (const tree of this.trees) {
      sum += tree.predict(x);
    }
    return sum / this.trees.length; // Returns probability for binary class 1
  }
}

// ---------------------------------------------------------
// Gradient Boosting (Simulates XGBoost / LightGBM profiles)
// ---------------------------------------------------------
export class GradientBoosting {
  trees: DecisionTree[] = [];
  numTrees: number;
  learningRate: number;
  maxDepth: number;
  featureImportance: number[] = [];

  constructor(numTrees: number = 10, learningRate: number = 0.1, maxDepth: number = 3) {
    this.numTrees = numTrees;
    this.learningRate = learningRate;
    this.maxDepth = maxDepth;
  }

  private sigmoid(z: number) {
    return 1 / (1 + Math.exp(-z));
  }

  train(X: Matrix, y: Vector) {
    this.trees = [];
    this.featureImportance = new Array(X[0].length).fill(0);
    
    // Initial prediction: 0 log-odds (0.5 prob)
    let F = new Array(X.length).fill(0);

    for (let i = 0; i < this.numTrees; i++) {
      // Calculate pseudo-residuals (gradients for log loss)
      const residuals = new Array(X.length);
      for (let j = 0; j < X.length; j++) {
        const prob = this.sigmoid(F[j]);
        residuals[j] = y[j] - prob; 
      }

      // Train regression tree on residuals
      const tree = new DecisionTree(this.maxDepth, 2, true);
      tree.train(X, residuals);
      this.trees.push(tree);

      // Update predictions
      for (let j = 0; j < X.length; j++) {
        F[j] += this.learningRate * tree.predict(X[j]);
      }

      // Aggregate importance
      tree.featureImportance.forEach((val, idx) => {
        this.featureImportance[idx] += val;
      });
    }

    // Normalize importance
    const sum = this.featureImportance.reduce((a,b)=>a+b, 0) || 1;
    this.featureImportance = this.featureImportance.map(v => v / sum);
  }

  predictProba(x: Vector): number {
    let F = 0;
    for (const tree of this.trees) {
      F += this.learningRate * tree.predict(x);
    }
    return this.sigmoid(F);
  }
}
