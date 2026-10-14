import assert from 'node:assert/strict';
import test from 'node:test';
import {parseHTML} from 'linkedom';
import {leaveSessionCloseReview} from '../../src/app/live-session-close';

function fixture(){
  const {document}=parseHTML('<dialog open></dialog><textarea id="draft"></textarea><textarea id="review"></textarea>');
  const dialog=document.querySelector('dialog') as HTMLDialogElement;
  dialog.close=()=>dialog.removeAttribute('open');
  const draft=document.querySelector('#draft') as HTMLTextAreaElement,review=document.querySelector('#review') as HTMLTextAreaElement;
  draft.value='Alter Entwurf';review.value='Weiter am Nordtor.';
  return{dialog,draft,review};
}

test('continuing from the close review retains its note for a return to the review',()=>{
  const x=fixture();leaveSessionCloseReview(x.dialog,x.draft,x.review,'continue');
  assert.equal(x.draft.value,'Weiter am Nordtor.');assert.equal(x.dialog.hasAttribute('open'),false);
});

test('cancelling the close review leaves the previous draft unchanged',()=>{
  const x=fixture();leaveSessionCloseReview(x.dialog,x.draft,x.review,'discard');
  assert.equal(x.draft.value,'Alter Entwurf');assert.equal(x.dialog.hasAttribute('open'),false);
});
