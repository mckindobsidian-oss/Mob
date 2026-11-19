chrome.storage.local.get("theme").then(({ theme }) => {
  document.documentElement.dataset.theme = theme || "plain";
});

chrome.runtime.sendMessage({type:"status"}).then(status=>{
 const line=document.querySelector("#setup-status");
 line.textContent=status?.linked?(status.tracking?"Linked · active-tab tracking enabled":"Linked · enable tracking in Mob Flow"):"Not linked yet · follow the steps below";
}).catch(()=>{document.querySelector("#setup-status").textContent="Open Mob to finish setup.";});
