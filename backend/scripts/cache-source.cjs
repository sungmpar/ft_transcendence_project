/* Preserve the hash-verified, secret-free source archive for repeatable API builds. */
'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
async function main(){
 const root=path.resolve(__dirname,'../..');const archive=path.join(root,'.migration-source.tar.gz');
 if(!fs.existsSync(archive))return;
 if(process.env.VERCEL_ENV!=='preview'||process.env.BLOB_STORE_ID!=='store_yUs8ha55aYRGrCue')throw new Error('Wrong archive preservation scope');
 const data=fs.readFileSync(archive);const digest=crypto.createHash('sha256').update(data).digest('hex');
 if(digest!==fs.readFileSync(path.join(root,'.migration-source.sha256'),'utf8').trim())throw new Error('Source checksum mismatch');
 const {head,put,BlobNotFoundError}=require('@vercel/blob');const pathname='migration-source/'+digest+'.tar.gz';let blob;
 try{blob=await head(pathname);}catch(e){if(!(e instanceof BlobNotFoundError))throw e;blob=await put(pathname,data,{access:'public',addRandomSuffix:false,allowOverwrite:false,contentType:'application/gzip'});}
 console.log('MIGRATION_SOURCE_ARCHIVE '+JSON.stringify({sha256:digest,size:data.length,url:blob.url}));
}
main().catch(()=>{console.error('Source preservation failed; no secrets are logged.');process.exitCode=1;});
