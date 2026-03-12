"use strict";

function handleMe(req, res) {
  return res.json({
    sub: req.user.sub,
    username: req.user.username,
    role: req.user.role,
    provider: req.user.provider || "local",
  });
}

module.exports = { handleMe };

