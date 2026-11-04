(function () {
    var root = document.getElementById('grwi-install-check');
    if (!root || !window.grwiAdmin) return;

    var widgetSelect = root.querySelector('[data-grwi-install-check-widget]');
    var urlInput = root.querySelector('[data-grwi-install-check-url]');
    var platformSelect = root.querySelector('[data-grwi-install-check-platform]');
    var button = root.querySelector('[data-grwi-install-check-submit]');
    var error = root.querySelector('[data-grwi-install-check-error]');
    var status = root.querySelector('[data-grwi-install-check-status]');
    var shownGuide = '';

    function clearStatus() {
        if (error) {
            error.hidden = true;
            error.textContent = '';
        }
        if (status) {
            status.hidden = true;
            status.replaceChildren();
            status.className = 'grw-install-check__status';
        }
        if (urlInput) urlInput.removeAttribute('aria-invalid');
        shownGuide = '';
    }

    function showError(message) {
        if (status) status.hidden = true;
        if (error) {
            error.hidden = false;
            error.textContent = message;
        }
        if (urlInput) {
            urlInput.setAttribute('aria-invalid', 'true');
            urlInput.focus();
        }
    }

    function addText(parent, className, text) {
        var el = document.createElement('p');
        el.className = className;
        el.textContent = text;
        parent.appendChild(el);
    }

    function renderGuide(guide) {
        if (!guide || !guide.steps) return;
        var wrap = document.createElement('div');
        wrap.className = 'grw-install-check__guide';
        addText(wrap, 'grw-install-check__title', guide.label ? ('How to fix this: ' + guide.label) : 'How to fix this');
        var list = document.createElement('ol');
        guide.steps.forEach(function (step) {
            var item = document.createElement('li');
            item.textContent = step;
            list.appendChild(item);
        });
        wrap.appendChild(list);
        var help = status.querySelector('.grw-install-check__help');
        if (help) status.insertBefore(wrap, help);
        else status.appendChild(wrap);
    }

    function renderHelp() {
        var help = document.createElement('div');
        help.className = 'grw-install-check__help';
        var open = document.createElement('button');
        open.type = 'button';
        open.className = 'grw-install-check__help-open';
        open.textContent = 'Get help';
        var form = document.createElement('div');
        form.className = 'grw-install-check__help-form';
        form.hidden = true;
        var label = document.createElement('label');
        label.className = 'grw-install-check__help-label';
        label.textContent = 'Message to support';
        var area = document.createElement('textarea');
        area.className = 'grw-install-check__help-message';
        area.placeholder = 'Anything else we should know?';
        area.maxLength = 2000;
        var actions = document.createElement('div');
        actions.className = 'grw-install-check__help-actions';
        var send = document.createElement('button');
        send.type = 'button';
        send.className = 'button button-primary grw-install-check__help-send';
        send.textContent = 'Send to support';
        var cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'grw-install-check__help-cancel';
        cancel.textContent = 'Cancel';
        var note = document.createElement('p');
        note.className = 'grw-install-check__help-note';
        note.hidden = true;
        open.addEventListener('click', function () {
            open.hidden = true;
            form.hidden = false;
            area.focus();
        });
        cancel.addEventListener('click', function () {
            form.hidden = true;
            open.hidden = false;
            note.hidden = true;
            area.value = '';
        });
        send.addEventListener('click', function () {
            if (!widgetSelect) return;
            send.disabled = true;
            note.hidden = true;
            post('grwi_install_help', {
                embed_key: widgetSelect.value,
                message: area.value
            }).then(function (result) {
                send.disabled = false;
                var payload = result.data || {};
                if (result.status === 429) {
                    note.hidden = false;
                    note.textContent = 'Too many help messages. Try again in about an hour.';
                    return;
                }
                if (payload.success) {
                    form.hidden = true;
                    open.hidden = true;
                    note.hidden = false;
                    note.textContent = (payload.data && payload.data.message) || 'Sent. We will reply to your email.';
                    return;
                }
                note.hidden = false;
                note.textContent = (payload.data && payload.data.message) || 'We couldn’t send that. Try again in a moment.';
            }).catch(function () {
                send.disabled = false;
                note.hidden = false;
                note.textContent = 'We couldn’t send that. Try again in a moment.';
            });
        });
        actions.appendChild(send);
        actions.appendChild(cancel);
        form.appendChild(label);
        form.appendChild(area);
        form.appendChild(actions);
        help.appendChild(open);
        help.appendChild(form);
        help.appendChild(note);
        status.appendChild(help);
    }

    function post(action, fields) {
        var body = new URLSearchParams();
        body.set('action', action);
        body.set('nonce', grwiAdmin.nonce);
        Object.keys(fields).forEach(function (key) {
            body.set(key, fields[key] == null ? '' : String(fields[key]));
        });
        return fetch(grwiAdmin.ajaxUrl, {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
            body: body.toString()
        }).then(function (response) {
            return response.json().catch(function () { return {}; }).then(function (data) {
                return { ok: response.ok, status: response.status, data: data };
            });
        });
    }

    function openGuide(platform) {
        if (!platform || shownGuide === platform || !widgetSelect) return;
        shownGuide = platform;
        post('grwi_install_guide', {
            embed_key: widgetSelect.value,
            platform: platform
        }).catch(function () {});
    }

    function renderResult(data) {
        status.hidden = false;
        status.className = 'grw-install-check__status grw-install-check__status--' + (data.result || 'unknown');
        status.replaceChildren();
        var heading = data.result === 'live'
            ? 'The widget code is on this page'
            : (data.result === 'not_found' ? 'This widget isn’t on that page' : 'We couldn’t tell');
        addText(status, 'grw-install-check__title', heading);
        if (data.message) addText(status, 'grw-install-check__message', data.message);
        if (data.result === 'not_found' && Array.isArray(data.checked_for)) {
            var list = document.createElement('ul');
            list.className = 'grw-install-check__checked';
            data.checked_for.forEach(function (item) {
                var li = document.createElement('li');
                li.textContent = item;
                list.appendChild(li);
            });
            status.appendChild(list);
        }
        if (data.hint) addText(status, 'grw-install-check__hint', data.hint);
        if (data.next_action && data.next_action.url) {
            var link = document.createElement('a');
            link.className = 'grw-install-check__next';
            link.href = data.next_action.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.textContent = data.next_action.label || 'Open this page';
            status.appendChild(link);
        }
        if (data.result !== 'live' && data.guide) {
            renderGuide(data.guide);
            openGuide(data.platform || (data.guide && data.guide.platform));
            if (data.result === 'not_found') renderHelp();
        }
    }

    function setBusy(busy) {
        root.setAttribute('aria-busy', busy ? 'true' : 'false');
        if (button) {
            button.disabled = busy;
            button.textContent = busy ? 'Checking…' : 'Check this page';
        }
        if (busy && status) {
            status.hidden = false;
            status.className = 'grw-install-check__status grw-install-check__status--loading';
            status.textContent = 'Checking the page…';
        }
    }

    function runCheck() {
        var url = urlInput ? urlInput.value.trim() : '';
        clearStatus();
        if (!url) {
            showError('Enter a full page address, starting with http:// or https://.');
            return;
        }
        setBusy(true);
        post('grwi_install_check', {
            embed_key: widgetSelect ? widgetSelect.value : '',
            url: url,
            platform: platformSelect ? platformSelect.value : 'wordpress_block'
        }).then(function (result) {
            setBusy(false);
            var payload = result.data || {};
            if (payload.success && payload.data) {
                renderResult(payload.data);
                return;
            }
            var message = (payload.data && payload.data.message) || 'We couldn’t run the check. Try again in a moment.';
            showError(message);
        }).catch(function () {
            setBusy(false);
            showError('We couldn’t run the check. Try again in a moment.');
        });
    }

    if (button) button.addEventListener('click', runCheck);
    if (urlInput) {
        urlInput.addEventListener('keydown', function (event) {
            if (event.key === 'Enter') {
                event.preventDefault();
                runCheck();
            }
        });
    }
    if (platformSelect) {
        platformSelect.addEventListener('change', function () {
            if (!status || status.hidden || !status.querySelector('.grw-install-check__guide')) return;
            var platform = platformSelect.value;
            if (!platform || !widgetSelect) return;
            post('grwi_install_guide', {
                embed_key: widgetSelect.value,
                platform: platform
            }).then(function (result) {
                var guide = result.data && result.data.success ? result.data.data.guide : null;
                if (!guide) return;
                var existing = status.querySelector('.grw-install-check__guide');
                if (existing) existing.remove();
                renderGuide(guide);
                shownGuide = platform;
            }).catch(function () {});
        });
    }

    document.querySelectorAll('[data-grwi-install-check-pick]').forEach(function (pick) {
        pick.addEventListener('click', function () {
            var key = pick.getAttribute('data-embed-key') || '';
            if (widgetSelect && key) widgetSelect.value = key;
            root.scrollIntoView({ behavior: 'smooth', block: 'start' });
            if (urlInput) urlInput.focus();
        });
    });
})();
