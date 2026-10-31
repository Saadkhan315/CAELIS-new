"use strict";
document.addEventListener("DOMContentLoaded", async () => {
  const $ = id => document.getElementById(id);
  const status = message => { $("resetStatus").textContent = message; };
  const params = new URLSearchParams(window.location.search);
  const destination = params.get("next") === "admin.html" ? "admin.html" : "index.html";
  $("returnLink").href = new URL(destination, window.location.href).href;

  const configured = window.supabase && window.CAELIS_SUPABASE_URL && window.CAELIS_SUPABASE_ANON_KEY &&
    !String(window.CAELIS_SUPABASE_URL).includes("PASTE_") && !String(window.CAELIS_SUPABASE_ANON_KEY).includes("PASTE_");
  if (!configured) {
    status("Password reset is not configured yet. Connect the Supabase project first.");
    return;
  }
  const db = window.supabase.createClient(window.CAELIS_SUPABASE_URL, window.CAELIS_SUPABASE_ANON_KEY);
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  if (hashParams.get("type") !== "recovery") {
    status("This reset link is missing or has expired. Request a new password-reset email from the sign-in screen.");
    return;
  }

  const { data, error } = await db.auth.getSession();
  if (error || !data?.session) {
    status("This reset link is invalid or has expired. Request a new password-reset email and open the newest link.");
    return;
  }
  window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
  $("resetPasswordForm").hidden = false;
  status("Your reset link is valid. Choose a new password.");

  $("resetPasswordForm").addEventListener("submit", async event => {
    event.preventDefault();
    const password = $("newPassword").value;
    const confirm = $("confirmPassword").value;
    if (password.length < 8) { status("Use a password with at least 8 characters."); return; }
    if (password !== confirm) { status("The two passwords do not match."); $("confirmPassword").focus(); return; }
    $("savePasswordButton").disabled = true;
    status("Updating your password…");
    try {
      const { error: updateError } = await db.auth.updateUser({ password });
      if (updateError) {
        status("Password was not updated. Choose a stronger password or request a new reset link.");
        return;
      }
      await db.auth.signOut({ scope: "global" });
      $("resetPasswordForm").hidden = true;
      status("Password updated. For your protection, sign in again with your new password.");
      $("returnLink").textContent = destination === "admin.html" ? "Continue to admin sign-in" : "Return to store sign-in";
    } catch {
      status("We could not update the password. Please request a new reset link and try again.");
    } finally {
      $("savePasswordButton").disabled = false;
    }
  });
});
