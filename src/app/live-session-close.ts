export type SessionCloseReviewExit='discard'|'continue';

export function leaveSessionCloseReview(dialog:HTMLDialogElement,draft:HTMLTextAreaElement,review:HTMLTextAreaElement,exit:SessionCloseReviewExit){
  if(exit==='continue')draft.value=review.value;
  dialog.close();
}
