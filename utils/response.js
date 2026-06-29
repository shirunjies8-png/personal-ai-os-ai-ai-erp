function ok(res, data = {}, message = 'ok') {
  res.json({ ok: true, message, data });
}

function fail(res, status, message, detail = null) {
  res.status(status).json({ ok: false, message, detail });
}

module.exports = {
  ok,
  fail
};
