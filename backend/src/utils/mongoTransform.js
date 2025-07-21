/**
 * Transform MongoDB document to include 'id' field and remove '_id'
 * @param {Object} doc MongoDB document
 * @returns {Object} Transformed document
 */
const transformDoc = (doc) => {
  if (!doc) return null;
  
  // Handle Mongoose documents
  if (doc.toObject) {
    doc = doc.toObject();
  }

  // Create a new object with transformed ID
  const transformed = { ...doc, id: doc._id.toString() };
  delete transformed._id;
  delete transformed.__v;

  return transformed;
};

/**
 * Transform an array of MongoDB documents
 * @param {Array} docs Array of MongoDB documents
 * @returns {Array} Array of transformed documents
 */
const transformDocs = (docs) => {
  if (!Array.isArray(docs)) return [];
  return docs.map(transformDoc);
};

module.exports = {
  transformDoc,
  transformDocs
};
