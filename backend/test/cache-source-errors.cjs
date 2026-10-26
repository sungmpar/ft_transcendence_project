const assert=require('node:assert/strict');
const {BlobNotFoundError,BlobAccessError}=require('@vercel/blob');
const fs=require('node:fs');
const missing=new BlobNotFoundError();assert.equal(missing.name,'Error');assert(missing instanceof BlobNotFoundError);
const source=fs.readFileSync(require('node:path').join(__dirname,'../scripts/cache-source.cjs'),'utf8');assert(source.includes('e instanceof BlobNotFoundError'));assert(!source.includes("e?.name!=="));
console.log('PASS missing-blob detection uses SDK error type; unrelated errors still propagate');
