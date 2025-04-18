const express = require('express');
const bodyParser = require('body-parser');

const app = express();
app.use(bodyParser.json());

// Configuration data
const productCenters = {
  'A': 'C1', 'B': 'C1', 'C': 'C1',
  'D': 'C2', 'E': 'C2', 'F': 'C2',
  'G': 'C3', 'H': 'C3', 'I': 'C3'
};

const productWeights = {
  'A': 3, 'B': 2, 'C': 8,
  'D': 12, 'E': 25, 'F': 15,
  'G': 0.5, 'H': 1, 'I': 2
};

const distances = {
  'C1-L1': 3,
  'C2-L1': 2.5,
  'C3-L1': 2,
  'C1-C2': 4,
  'C1-C3': 5,
  'C2-C3': 3
};

// Helper function to get distance between two locations
function getDistance(loc1, loc2) {
  if (loc1 === loc2) return 0;
  
  // Try direct lookup
  const key1 = `${loc1}-${loc2}`;
  if (distances[key1] !== undefined) return distances[key1];
  
  // Try reverse lookup
  const key2 = `${loc2}-${loc1}`;
  if (distances[key2] !== undefined) return distances[key2];
  
  return 0;
}

// Calculate cost for a given weight and distance
function calculateCost(weight, distance) {
  if (distance === 0) return 0;
  
  // Base cost for any distance is 10 units per distance (even with 0 weight)
  const baseCost = 10 * distance;
  
  // Additional cost for weight over 5kg
  if (weight > 5) {
    const additionalWeight = weight - 5;
    const additionalBlocks = Math.ceil(additionalWeight / 5);
    const additionalCost = additionalBlocks * 8 * distance;
    return baseCost + additionalCost;
  } else {
    return baseCost;
  }
}

// Calculate the cost of a specific route with detailed tracking
function calculateRouteCost(route, centerWeights, debug = false) {
  let totalCost = 0;
  let currentWeight = 0;
  let currentLocation = route[0];
  
  // Add detailed logging when debug is true
  if (debug) {
    console.log(`Starting route: ${route.join(' → ')}`);
    console.log(`Center weights: `, centerWeights);
  }
  
  // Initially pick up from first center
  currentWeight += centerWeights[currentLocation] || 0;
  if (debug) console.log(`Picked up ${centerWeights[currentLocation] || 0}kg at ${currentLocation}. Current weight: ${currentWeight}kg`);
  
  // Process each stop in the route
  for (let i = 1; i < route.length; i++) {
    const nextLocation = route[i];
    const distance = getDistance(currentLocation, nextLocation);
    
    // Calculate cost based on current weight and distance
    const segmentCost = calculateCost(currentWeight, distance);
    
    if (debug) {
      console.log(`Traveling ${currentLocation} → ${nextLocation}, distance: ${distance}, weight: ${currentWeight}kg`);
      
      if (currentWeight > 5) {
        const additionalWeight = currentWeight - 5;
        const additionalBlocks = Math.ceil(additionalWeight / 5);
        console.log(`  Base cost: 10 × ${distance} = ${10 * distance}`);
        console.log(`  Additional cost: ceil((${currentWeight} - 5) / 5) × 8 × ${distance} = ${additionalBlocks} × 8 × ${distance} = ${additionalBlocks * 8 * distance}`);
        console.log(`  Segment cost: ${segmentCost}`);
      } else {
        console.log(`  Segment cost: 10 × ${distance} = ${segmentCost}`);
      }
    }
    
    totalCost += segmentCost;
    
    // Update location
    currentLocation = nextLocation;
    
    // If we're at L1, drop off all products
    if (currentLocation === 'L1') {
      if (debug) console.log(`Arrived at L1, dropping off all products. Weight reset to 0kg`);
      currentWeight = 0;
    } 
    // If we're at a center, pick up products
    else {
      const newWeight = centerWeights[currentLocation] || 0;
      currentWeight += newWeight;
      if (debug) console.log(`Picked up ${newWeight}kg at ${currentLocation}. Current weight: ${currentWeight}kg`);
    }
  }
  
  if (debug) console.log(`Total route cost: ${Math.round(totalCost)}`);
  
  return Math.round(totalCost);
}

// Generate all permutations of centers
function permute(arr) {
  if (arr.length <= 1) return [arr];
  
  const result = [];
  for (let i = 0; i < arr.length; i++) {
    const current = arr[i];
    const remaining = [...arr.slice(0, i), ...arr.slice(i + 1)];
    const permutations = permute(remaining);
    
    for (const perm of permutations) {
      result.push([current, ...perm]);
    }
  }
  
  return result;
}

// Generate all possible routes considering L1 insertions
function generateAllPossibleRoutes(centers) {
  // Get all permutations of centers
  const centerPermutations = permute(centers);
  
  const allRoutes = [];
  
  // For each permutation, generate all possible L1 insertion patterns
  centerPermutations.forEach(centerOrder => {
    // Generate all possible patterns of L1 insertions
    const n = centerOrder.length;
    // 2^(n-1) possible L1 insertion patterns (excluding before first center)
    const possiblePatterns = 1 << (n - 1);
    
    for (let pattern = 0; pattern < possiblePatterns; pattern++) {
      const route = [centerOrder[0]]; // Start with first center
      
      for (let i = 1; i < n; i++) {
        // Check if we should insert L1 before this center
        if ((pattern & (1 << (i - 1))) !== 0) {
          route.push('L1');
        }
        route.push(centerOrder[i]);
      }
      
      // Always end at L1
      if (route[route.length - 1] !== 'L1') {
        route.push('L1');
      }
      
      allRoutes.push(route);
    }
  });
  
  return allRoutes;
}

// Main function to calculate minimum delivery cost
function findMinimumCost(order, debug = false) {
  // Calculate weight from each center
  const centerWeights = { 'C1': 0, 'C2': 0, 'C3': 0 };
  const requiredCenters = new Set();
  
  // Calculate weights and identify required centers
  for (const [product, quantity] of Object.entries(order)) {
    if (quantity > 0 && productCenters[product]) {
      const center = productCenters[product];
      centerWeights[center] += productWeights[product] * quantity;
      requiredCenters.add(center);
    }
  }
  
  if (debug) {
    console.log("Order details:");
    console.log(order);
    console.log("Center weights:");
    console.log(centerWeights);
    console.log("Required centers:");
    console.log(Array.from(requiredCenters));
  }
  
  // If no products are ordered, return 0
  if (requiredCenters.size === 0) return { minimumCost: 0, bestRoute: [] };
  
  const centers = Array.from(requiredCenters);
  
  // For single center, direct route is optimal
  if (centers.length === 1) {
    const center = centers[0];
    const route = [center, 'L1'];
    const cost = calculateRouteCost(route, centerWeights, debug);
    
    if (debug) {
      console.log(`Single center ${center}, direct route is optimal`);
      console.log(`Route: ${route.join(' → ')}, Cost: ${cost}`);
    }
    
    return {
      minimumCost: cost,
      bestRoute: route
    };
  }
  
  // Generate all possible routes
  const allRoutes = generateAllPossibleRoutes(centers);
  
  if (debug) {
    console.log(`Generated ${allRoutes.length} possible routes`);
  }
  
  // Find the minimum cost route
  let minCost = Infinity;
  let bestRoute = null;
  
  for (const route of allRoutes) {
    const cost = calculateRouteCost(route, centerWeights, debug);
    
    if (debug) {
      console.log(`Route: ${route.join(' → ')}, Cost: ${cost}`);
    }
    
    if (cost < minCost) {
      minCost = cost;
      bestRoute = route;
    }
  }
  
  if (debug) {
    console.log(`Best route found: ${bestRoute.join(' → ')}, Cost: ${minCost}`);
  }
  
  return {
    minimumCost: minCost,
    bestRoute: bestRoute
  };
}

// Test specific cases
function runTestCase(description, order, expectedCost) {
  console.log(`\n=== Test Case: ${description} ===`);
  const result = findMinimumCost(order, true);
  console.log(`Result: ${result.minimumCost}, Expected: ${expectedCost}`);
  console.log(`Best route: ${result.bestRoute.join(' → ')}`);
  console.log(`Test ${result.minimumCost === expectedCost ? 'PASSED' : 'FAILED'}`);
  return result;
}

// API endpoint
app.post('/api/delivery-cost', (req, res) => {
  try {
    const order = req.body;
    const result = findMinimumCost(order);
    
    res.json({
      minimumCost: result.minimumCost,
      bestRoute: result.bestRoute
    });
  } catch (error) {
    res.status(400).json({
      error: error.message
    });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = app;