import {createHash} from "node:crypto";
import {mkdtemp,readFile,readdir,rm,writeFile} from "node:fs/promises";
import {tmpdir} from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";
import {strToU8,zipSync} from "fflate";
import {
  readArchive,
  type ArchiveFile,
} from "../../../desktop/zip-files";

const digest=(data:Uint8Array)=>createHash("sha256").update(data).digest("hex");
const hooks={check:()=>{},progress:()=>{}};
const allowed=(name:string)=>name==="campaign.sqlite";
const declaredFiles=(value:unknown)=>{
  const files=(value as {files?:ArchiveFile[]}).files;
  if(!Array.isArray(files))throw new Error("Ungültiges Testmanifest.");
  return new Map(files.map(file=>[file.name,file]));
};

async function fixture(entries:Record<string,Uint8Array>){
  const root=await mkdtemp(path.join(tmpdir(),"campaign-archive-"));
  const archive=path.join(root,"campaign.dungeon-campaign");
  await writeFile(archive,zipSync(entries,{level:9}));
  return{root,archive};
}

test("archive extraction accepts exactly the bytes declared by the leading manifest",async()=>{
  const payload=strToU8("valid campaign database"),file={name:"campaign.sqlite",bytes:payload.length,sha256:digest(payload)};
  const {root,archive}=await fixture({"manifest.json":strToU8(JSON.stringify({files:[file]})),"campaign.sqlite":payload});
  try{
    const extracted=await readArchive(archive,path.join(root,"imports"),allowed,declaredFiles,hooks);
    assert.deepEqual(await readFile(path.join(extracted.dir,"campaign.sqlite")),Buffer.from(payload));
    assert.deepEqual(extracted.files.get("campaign.sqlite"),file);
    await rm(extracted.dir,{recursive:true,force:true});
  }finally{await rm(root,{recursive:true,force:true});}
});

test("archive extraction stops decompression as soon as an entry exceeds its declared size",async()=>{
  const declared=strToU8("tiny"),expanded=new Uint8Array(1024*1024).fill(65);
  const file={name:"campaign.sqlite",bytes:declared.length,sha256:digest(declared)};
  const {root,archive}=await fixture({"manifest.json":strToU8(JSON.stringify({files:[file]})),"campaign.sqlite":expanded});
  try{
    await assert.rejects(readArchive(archive,path.join(root,"imports"),allowed,declaredFiles,hooks),/Dekomprimierte Dateigröße überschreitet/);
    assert.deepEqual(await readdir(path.join(root,"imports")),[]);
  }finally{await rm(root,{recursive:true,force:true});}
});

test("archive extraction rejects entries outside the manifest and manifests that are not first",async()=>{
  const empty=strToU8(JSON.stringify({files:[]}));
  for(const entries of [
    {"manifest.json":empty,"campaign.sqlite":strToU8("undeclared")},
    {"campaign.sqlite":strToU8("before manifest"),"manifest.json":empty},
  ]){
    const {root,archive}=await fixture(entries);
    try{
      await assert.rejects(readArchive(archive,path.join(root,"imports"),allowed,declaredFiles,hooks),/nicht deklarierten|manifest.*erste/i);
      assert.deepEqual(await readdir(path.join(root,"imports")),[]);
    }finally{await rm(root,{recursive:true,force:true});}
  }
});
