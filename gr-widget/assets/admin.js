(function ($) {
    'use strict';

    var catalog = (window.grwiAdmin && grwiAdmin.layoutCatalog) ? grwiAdmin.layoutCatalog : [];
    var i18n = (window.grwiAdmin && grwiAdmin.i18n) ? grwiAdmin.i18n : {};
    var paidLayoutToastShown = false;

    function previewFirstEnabled() {
        var cfg = window.grwiAdmin || {};
        return cfg.previewFirst === true || cfg.previewFirst === 1 || cfg.previewFirst === '1';
    }

    function hidePreviewFirstToast() {
        var $toast = $('#grwi-preview-first-toast');
        if ($toast.length) {
            $toast.attr('hidden', true);
        }
    }

    function showPreviewFirstToast(title, body) {
        var $toast = $('#grwi-preview-first-toast');
        if (!$toast.length) {
            return;
        }
        $('#grwi-preview-first-toast-title').text(title || '');
        $('#grwi-preview-first-toast-body').text(body || '');
        $toast.removeAttr('hidden');
        window.setTimeout(hidePreviewFirstToast, 8000);
    }
    var LAYOUT_FEATURE_SLUGS = {
        feed_masonry: 'premium_layout_masonry',
        feed_slider: 'premium_layout_slider',
        feed_classic_carousel: 'premium_layout_classic_carousel',
        feed_classic_masonry: 'premium_layout_classic_masonry',
        sticker_bold: 'premium_layout_bold',
        sticker_ribbon: 'premium_layout_ribbon',
        sticker_pill: 'premium_layout_pill'
    };
    var previewDemo = (window.grwiAdmin && grwiAdmin.layoutPreviewDemo) ? grwiAdmin.layoutPreviewDemo : null;
    var previewTheme = (window.grwiAdmin && grwiAdmin.layoutPreviewTheme) ? grwiAdmin.layoutPreviewTheme : ((previewDemo && previewDemo.preview_theme) ? previewDemo.preview_theme : 'dark');
    var $search = $('#grwi-place-search');
    var $searchWrap = $('#grwi-search-wrap');
    var $results = $('#grwi-place-results');
    var $recentPlaces = $('#grwi-recent-places');
    var $recentPlacesList = $('#grwi-recent-places-list');
    var $selected = $('#grwi-selected-place');
    var $selectedText = $('#grwi-selected-place-text');
    var $createForm = $('#grwi-create-form');
    var $submitBtn = $createForm.find('.grw-submit, input[type="submit"]');
    var debounceTimer = null;
    var searchRequest = null;
    var searchSeq = 0;
    var activeSearchQuery = '';
    var livePreviewMounted = false;
    var selectedPlace = null;
    var selectedLayout = $('#grwi-layout').val() || 'badge_card';
    var previewingLockedLayout = false;
    var previewingLockedEntitlement = '';
    var previewingLockedPlan = 'Site';
    var previewingLockedLabel = '';
    var lockedPreviewScrollY = null;
    var syncPollTimer = null;
    var syncToastTimer = null;
    var syncActivePlaceId = null;
    var syncComplete = false;
    var syncPollAttempts = 0;
    var SYNC_POLL_MAX = 20;
    var cachedRecentPlaces = [];
    var syncedPreviewReviews = [];
    var hasSyncedPreviewReviews = false;
    var $syncNotice = $('#grwi-sync-notice');
    var $syncToast = $('#grwi-sync-toast');
    var $syncRetry = $('#grwi-sync-notice-retry');

    /** Wait for hosted grw-preview.js (defines grwWhenPreviewReady) before mounting previews. */
    function grwiWhenPreviewReady(cb) {
        if (typeof cb !== 'function') {
            return false;
        }
        if (typeof window.grwiWhenPreviewReady === 'function') {
            window.grwiWhenPreviewReady(cb);
            return true;
        }
        if (typeof window.grwWhenPreviewReady === 'function') {
            window.grwWhenPreviewReady(cb);
            return true;
        }
        if (window.GrwPreview) {
            cb();
            return true;
        }
        return false;
    }

    function placeIdKey(place) {
        return String(place && (place.place_id || place.id) || '').trim();
    }

    function normalizePlacesList(places, options) {
        options = options || {};
        var excludeId = options.excludePlaceId ? String(options.excludePlaceId).trim() : '';
        var seen = {};
        var normalized = [];

        (places || []).forEach(function (place) {
            var id = placeIdKey(place);
            if (!id || seen[id]) {
                return;
            }
            if (excludeId && id === excludeId) {
                return;
            }
            seen[id] = true;
            normalized.push(place);
        });

        return normalized;
    }

    function setFormBusy(isBusy) {
        if (!$createForm.length) {
            return;
        }
        $createForm.toggleClass('grw-create-form--busy', isBusy);
        // Never disable hidden fields — disabled inputs are omitted from form POST.
        $createForm.find('input:not([type="hidden"]), button, select, textarea').not('.grw-create-form__overlay').prop('disabled', isBusy);
        if ($submitBtn.length) {
            $submitBtn.val(isBusy ? (i18n.creating || 'Creating widget…') : (i18n.createWidget || 'Create widget'));
        }
    }

    function placeFromForm() {
        var placeId = $('#grwi-place-id').val();
        if (!placeId) {
            return null;
        }
        return {
            place_id: placeId,
            business_name: $('#grwi-business-name').val() || '',
            formatted_address: $('#grwi-formatted-address').val() || '',
            rating: $('#grwi-rating').val() !== '' ? parseFloat($('#grwi-rating').val()) : null,
            review_count: $('#grwi-review-count').val() !== '' ? parseInt($('#grwi-review-count').val(), 10) : null
        };
    }

    function buildPreviewPlace(place, opts) {
        opts = opts || {};
        var demoPlace = (previewDemo && previewDemo.place) ? previewDemo.place : {};
        var useDemoStats = opts.layoutPickerPreview || !syncComplete;
        return $.extend({}, demoPlace, {
            place_id: place.place_id || '',
            business_name: place.business_name || place.name || demoPlace.business_name || 'Your Business',
            formatted_address: place.formatted_address || '',
            location_label: place.formatted_address || demoPlace.location_label || '',
            rating: useDemoStats
                ? (demoPlace.rating != null ? demoPlace.rating : 4.8)
                : (place.rating != null ? place.rating : (demoPlace.rating || 5)),
            review_count: useDemoStats
                ? (demoPlace.review_count != null ? demoPlace.review_count : 14)
                : (place.review_count != null ? place.review_count : (demoPlace.review_count || 0))
        });
    }

    function previewConfigForLayout(layout, themeOverride) {
        if (!window.GrwiPreviewOpts) {
            var configs = (previewDemo && previewDemo.configs) ? previewDemo.configs : {};
            var base = configs[layout] || {};
            return $.extend({}, base, {
                theme: themeOverride || previewTheme,
                layout: layout,
                show_branding: false,
                layoutPickerPreview: true,
                flyout_enabled: false,
                review_click_action: 'none'
            });
        }
        return GrwiPreviewOpts.buildLayoutPickerPreviewOpts({
            layout: layout,
            theme: themeOverride || previewTheme,
            previewDemo: previewDemo
        });
    }

    function layoutPickerStyleReviews() {
        return (previewDemo && previewDemo.reviews) ? previewDemo.reviews.slice(0, 6) : [];
    }

    function livePreviewReviews() {
        if (hasSyncedPreviewReviews && syncedPreviewReviews.length) {
            return syncedPreviewReviews.slice(0, 6);
        }
        return layoutPickerStyleReviews();
    }

    function resetSyncedPreview() {
        syncedPreviewReviews = [];
        hasSyncedPreviewReviews = false;
    }

    function previewReviewPhotoUrl(item) {
        if (typeof item === 'string') {
            return item.trim();
        }
        if (!item || typeof item !== 'object') {
            return '';
        }
        var url = item.photoUri || item.photo_uri || item.uri || item.url || item.src || '';
        return typeof url === 'string' ? url.trim() : '';
    }

    function previewReviewPhotoUrls(review) {
        var urls = [];
        var seen = {};
        function pushBucket(raw) {
            if (!Array.isArray(raw)) {
                return;
            }
            raw.forEach(function (item) {
                var url = previewReviewPhotoUrl(item);
                if (!url || seen[url]) {
                    return;
                }
                seen[url] = true;
                urls.push(url);
            });
        }
        if (!review || typeof review !== 'object') {
            return urls;
        }
        pushBucket(review.photo_urls);
        pushBucket(review.photos);
        pushBucket(review.review_photos);
        pushBucket(review.review_images);
        return urls;
    }

    function normalizeSyncedPreviewReviews(reviews) {
        if (!Array.isArray(reviews)) {
            return [];
        }
        return reviews.map(function (review) {
            if (!review || typeof review !== 'object') {
                return review;
            }
            var urls = previewReviewPhotoUrls(review);
            if (!urls.length) {
                return review;
            }
            return $.extend({}, review, { photo_urls: urls });
        });
    }

    function applySyncedPreviewFromStatus(data) {
        var reviews = (data && Array.isArray(data.reviews)) ? normalizeSyncedPreviewReviews(data.reviews) : [];
        if (!reviews.length) {
            return false;
        }
        var alreadyShowing = hasSyncedPreviewReviews && syncedPreviewReviews.length === reviews.length;
        syncedPreviewReviews = reviews;
        hasSyncedPreviewReviews = true;
        if (data.place && selectedPlace && placeIdKey(data.place) === placeIdKey(selectedPlace)) {
            if (data.place.rating != null) {
                selectedPlace.rating = data.place.rating;
                $('#grwi-rating').val(data.place.rating);
            }
            if (data.place.review_count != null) {
                selectedPlace.review_count = data.place.review_count;
                $('#grwi-review-count').val(data.place.review_count);
            }
        }
        return !alreadyShowing;
    }

    function hostedPreviewPlace(place, reviews, state) {
        var demo = (previewDemo && previewDemo.place) ? previewDemo.place : null;
        if (!place) {
            return place;
        }

        var hasCachedReviews = !!(state && state.hasCachedReviews);
        var inPlaceholderState = !!(state && state.placeholder);

        // Badge rating/count = Google place totals when synced — not curated review subset.
        if (hasCachedReviews || !inPlaceholderState) {
            return place;
        }

        if (!demo) {
            return place;
        }

        return $.extend({}, place, {
            rating: demo.rating,
            review_count: demo.review_count,
        });
    }

    function placeFromWidgetPayload(data) {
        var business = data.business || data.place || {};
        return {
            place_id: business.place_id || '',
            business_name: business.name || business.business_name || '',
            formatted_address: business.formatted_address || business.address || '',
            profile_url: business.profile_url || business.googleMapsUri || '',
            rating: business.rating,
            review_count: business.review_count,
        };
    }

    function savedWidgetPreviewMeta() {
        if (window.grwiAdmin && grwiAdmin.layoutPreviewMeta) {
            return grwiAdmin.layoutPreviewMeta;
        }
        return {
            layout_picker_demo: previewDemo,
            layout_master_defaults: null,
        };
    }

    function prepareSavedWidgetPreviewMount(mountEl, wrapperClass) {
        if (!mountEl) {
            return;
        }
        mountEl.setAttribute('data-wb-builder-preview', '');
        if (wrapperClass) {
            mountEl.setAttribute('data-preview-wrapper-class', wrapperClass);
        }
    }

    var savedDashboardPreviews = Object.create(null);
    function loadSavedDashboardPreview(key) {
        if (!savedDashboardPreviews[key]) savedDashboardPreviews[key] = new Promise(function (resolve, reject) {
            $.post(grwiAdmin.ajaxUrl, {action:'grwi_dashboard_widget_preview',nonce:grwiAdmin.nonce,embed_key:key})
                .done(function (response) { if (response && response.success && response.data) resolve(response.data); else reject(new Error('Saved preview unavailable')); })
                .fail(reject);
        });
        return savedDashboardPreviews[key];
    }

    function savedPreviewLabel(data) { return data.preview_state === 'draft' ? 'Saved draft preview · unpublished changes' : ''; }

    function mountSavedWidgetPreviewFromPayload(mountEl, data) {
        if (!mountEl || !window.GrwPreview || typeof GrwPreview.mount !== 'function' || !window.GrwiPreviewOpts) {
            return false;
        }
        var layout = data.layout || 'badge_card';
        var savedConfig = data.config || {};
        var hasCachedReviews = Array.isArray(data.reviews) && data.reviews.length > 0;
        var reviews = hasCachedReviews ? data.reviews : [];
        var place = placeFromWidgetPayload(data);
        prepareSavedWidgetPreviewMount(mountEl, mountEl.getAttribute('data-preview-wrapper-class') || '');
        try {
            GrwPreview.mount(
                mountEl,
                place,
                layout,
                GrwiPreviewOpts.buildSavedWidgetPreviewOpts({
                    layout: layout,
                    savedConfig: savedConfig,
                    previewMeta: data.preview_meta || savedWidgetPreviewMeta(),
                    reviews: reviews,
                })
            );
            return true;
        } catch (err) {
            return false;
        }
    }

    function mountLayoutPickerStylePreview(mountEl, placeInput, layout, extraConfig) {
        if (!mountEl || !window.GrwPreview || typeof GrwPreview.mount !== 'function') {
            return false;
        }
        if (!window.GrwiPreviewOpts) {
            return false;
        }
        var layoutKey = layout || 'badge_card';
        var reviews = layoutPickerStyleReviews();
        var extra = extraConfig || {};
        var mountReviews = Array.isArray(extra.reviews) && extra.reviews.length
            ? extra.reviews
            : reviews;
        var config = GrwiPreviewOpts.buildLayoutPickerPreviewOpts({
            layout: layoutKey,
            theme: extra.theme,
            previewDemo: previewDemo,
            extra: extra,
            reviews: mountReviews,
            maxReviews: extra.maxReviews != null ? extra.maxReviews : Math.min(mountReviews.length, 6),
            filledClass: extra.filledClass,
            presentation: extra.presentation
        });
        try {
            GrwPreview.mount(
                mountEl,
                buildPreviewPlace(placeInput || {}, { layoutPickerPreview: true }),
                layoutKey,
                config
            );
            return true;
        } catch (err) {
            return false;
        }
    }

    function stopSyncPoll() {
        clearTimeout(syncPollTimer);
        syncPollTimer = null;
    }

    function hideSyncNotice() {
        if ($syncNotice.length) {
            $syncNotice.attr('hidden', true).removeClass('grw-sync-notice--error');
        }
        if ($syncRetry.length) {
            $syncRetry.attr('hidden', true);
        }
    }

    function showSyncNotice(businessName) {
        if (!$syncNotice.length) {
            return;
        }
        var title = i18n.syncBackgroundTitle || 'Syncing reviews in the background';
        var hint = i18n.syncBackgroundHint || 'You can continue building your widget — live review data will appear in the preview shortly.';
        if (businessName) {
            hint = 'Fetching reviews for ' + businessName + '. ' + hint;
        }
        $('#grwi-sync-notice-title').text(title);
        $('#grwi-sync-notice-hint').text(hint);
        $syncNotice.removeClass('grw-sync-notice--error').removeAttr('hidden');
        if ($syncRetry.length) {
            $syncRetry.attr('hidden', true);
        }
        hideSyncToast();
    }

    function safeUpgradeUrl(url) {
        if (!url) {
            return '';
        }
        try {
            var parsed = new URL(url, window.location.href);
            var host = (parsed.hostname || '').toLowerCase();
            if (parsed.protocol !== 'https:') {
                return '';
            }
            if (host === 'grwidget.com' || host === 'www.grwidget.com' || host === 'staging.grwidget.com') {
                return parsed.href;
            }
        } catch (err) {
            return '';
        }
        return '';
    }

    function isGoogleBusinessLimit(message) {
        return /Google business/i.test(String(message || ''));
    }

    function onSyncFailed(message, upgradeUrl) {
        stopSyncPoll();
        if (isGoogleBusinessLimit(message)) {
            showAdminNotice(message, 'error', upgradeUrl);
        }
        if (!$syncNotice.length) {
            return;
        }
        if (isGoogleBusinessLimit(message)) {
            $('#grwi-sync-notice-title').text(message);
            $('#grwi-sync-notice-hint').text(i18n.googleBusinessLimitHint || 'That listing would be another Google business. Upgrade to add it, or choose a listing you already use.');
        } else {
            $('#grwi-sync-notice-title').text(i18n.syncFailedTitle || 'Could not sync reviews');
            $('#grwi-sync-notice-hint').text(message || i18n.syncFailedHint || 'Review sync did not finish. You can keep building with demo reviews, or try again.');
        }
        $syncNotice.addClass('grw-sync-notice--error').removeAttr('hidden');
        if ($syncRetry.length) {
            if (isGoogleBusinessLimit(message)) {
                $syncRetry.attr('hidden', true);
            } else {
                $syncRetry.removeAttr('hidden');
            }
        }
        updatePreviewSubtitle();
    }

    function hideSyncToast() {
        clearTimeout(syncToastTimer);
        syncToastTimer = null;
        if ($syncToast.length) {
            $syncToast.attr('hidden', true).removeClass('grw-sync-toast--warning');
        }
    }

    function showSyncToast(message, type) {
        if (!$syncToast.length || !message) {
            return;
        }
        hideSyncToast();
        $('#grwi-sync-toast-text').text(message);
        $syncToast.toggleClass('grw-sync-toast--warning', type === 'warning');
        $syncToast.find('.grw-sync-toast__icon')
            .toggleClass('dashicons-yes-alt', type !== 'warning')
            .toggleClass('dashicons-warning', type === 'warning');
        $syncToast.removeAttr('hidden');
        syncToastTimer = window.setTimeout(hideSyncToast, type === 'warning' ? 8000 : 6000);
    }

    function updatePreviewSubtitle() {
        var $sub = $('#grwi-live-preview-sub');
        if (!$sub.length) {
            return;
        }
        if (hasSyncedPreviewReviews) {
            $sub.text(i18n.syncPreviewReady || 'Showing your synced Google reviews.');
        } else if (syncComplete) {
            $sub.text(i18n.syncPreviewReady || 'Showing your synced Google reviews.');
        } else {
            $sub.text(i18n.syncPreviewDemo || 'Preview uses your business name and rating with demo reviews until sync completes.');
        }
    }

    function onSyncComplete() {
        syncComplete = true;
        hideSyncNotice();
        showSyncToast(i18n.syncComplete || 'Your reviews are synced and ready');
        updatePreviewSubtitle();
        mountLivePreview();
    }

    function onSyncPending() {
        var place = selectedPlace || placeFromForm();
        showSyncNotice(place ? (place.business_name || place.name || '') : '');
    }

    function pollPlaceSyncStatus(placeId) {
        var pollMs = (window.grwiAdmin && grwiAdmin.syncPollMs) ? grwiAdmin.syncPollMs : 1500;
        syncPollAttempts = 0;

        function poll() {
            if (syncActivePlaceId !== placeId) {
                return;
            }
            syncPollAttempts += 1;
            if (syncPollAttempts > SYNC_POLL_MAX) {
                onSyncFailed();
                return;
            }

            $.get(grwiAdmin.ajaxUrl, {
                action: 'grwi_place_sync_status',
                nonce: grwiAdmin.nonce,
                place_id: placeId
            }).done(function (response) {
                if (syncActivePlaceId !== placeId) {
                    return;
                }
                if (!response || !response.success) {
                    var failMessage = response && response.data && response.data.message ? response.data.message : '';
                    if (syncPollAttempts >= SYNC_POLL_MAX) {
                        onSyncFailed(failMessage);
                        return;
                    }
                    syncPollTimer = window.setTimeout(poll, pollMs);
                    return;
                }
                var status = (response.data && response.data.status) ? response.data.status : 'syncing';
                var shouldRemount = applySyncedPreviewFromStatus(response.data);
                if (status === 'complete') {
                    stopSyncPoll();
                    onSyncComplete();
                    return;
                }
                if (shouldRemount) {
                    updatePreviewSubtitle();
                    mountLivePreview();
                }
                if (status === 'failed') {
                    onSyncFailed();
                    return;
                }
                syncPollTimer = window.setTimeout(poll, pollMs);
            }).fail(function (xhr) {
                if (syncActivePlaceId !== placeId) {
                    return;
                }
                var failMessage = '';
                if (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                    failMessage = xhr.responseJSON.data.message;
                }
                if (syncPollAttempts >= SYNC_POLL_MAX) {
                    onSyncFailed(failMessage);
                    return;
                }
                syncPollTimer = window.setTimeout(poll, pollMs);
            });
        }

        poll();
    }

    function triggerPlaceSync(place) {
        if (!place || !place.place_id) {
            return;
        }

        syncActivePlaceId = place.place_id;
        syncComplete = false;
        syncPollAttempts = 0;
        updatePreviewSubtitle();
        onSyncPending();

        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_sync_place',
            nonce: grwiAdmin.nonce,
            place_id: place.place_id,
            business_name: place.business_name || place.name || '',
            formatted_address: place.formatted_address || '',
            rating: place.rating != null ? place.rating : '',
            review_count: place.review_count != null ? place.review_count : ''
        }).done(function () {
            pollPlaceSyncStatus(place.place_id);
        }).fail(function (xhr) {
            var failMessage = '';
            var upgradeUrl = '';
            if (xhr && xhr.responseJSON && xhr.responseJSON.data) {
                failMessage = xhr.responseJSON.data.message || '';
                upgradeUrl = xhr.responseJSON.data.upgrade_url || '';
            }
            onSyncFailed(failMessage, upgradeUrl);
        });
    }

    function wpAdminBarOffset() {
        var bar = document.getElementById('wpadminbar');
        if (!bar) {
            return 0;
        }
        var style = window.getComputedStyle ? window.getComputedStyle(bar) : bar.style;
        var position = style && style.position ? style.position : '';
        if (position !== 'fixed' && position !== 'sticky') {
            return 0;
        }
        return bar.offsetHeight || 0;
    }

    function isLivePreviewComfortablyVisible($panel) {
        if (!$panel || !$panel.length) {
            return false;
        }
        var el = $panel[0];
        var rect = el.getBoundingClientRect();
        var topInset = wpAdminBarOffset() + 8;
        var viewHeight = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!viewHeight || rect.height <= 0) {
            return false;
        }
        var visibleTop = Math.max(rect.top, topInset);
        var visibleBottom = Math.min(rect.bottom, viewHeight);
        var visible = visibleBottom - visibleTop;
        if (visible <= 0) {
            return false;
        }
        if (rect.top >= topInset && rect.top < viewHeight * 0.72) {
            return true;
        }
        return visible >= Math.min(rect.height, 160);
    }

    var previewScrollTimer = null;
    var PREVIEW_SCROLL_MS = 480;

    function animateScrollTo(top, duration) {
        var start = window.pageYOffset || document.documentElement.scrollTop || 0;
        var diff = top - start;
        if (Math.abs(diff) < 8) {
            return;
        }
        duration = duration || PREVIEW_SCROLL_MS;
        if (typeof window.requestAnimationFrame !== 'function') {
            window.scrollTo(0, top);
            return;
        }
        var startTime = null;
        function step(ts) {
            if (startTime === null) {
                startTime = ts;
            }
            var t = Math.min(1, (ts - startTime) / duration);
            var eased = t < 0.5
                ? 4 * t * t * t
                : 1 - Math.pow(-2 * t + 2, 3) / 2;
            window.scrollTo(0, start + (diff * eased));
            if (t < 1) {
                window.requestAnimationFrame(step);
            }
        }
        window.requestAnimationFrame(step);
    }

    function scrollLivePreviewIntoView() {
        var $panel = $('#grwi-wp-live-preview');
        if (!$panel.length || $panel.is('[hidden]')) {
            return;
        }
        if (previewScrollTimer) {
            clearTimeout(previewScrollTimer);
        }
        previewScrollTimer = setTimeout(function () {
            previewScrollTimer = null;
            function run() {
                if (!$panel.length || $panel.is('[hidden]')) {
                    return;
                }
                if (isLivePreviewComfortablyVisible($panel)) {
                    return;
                }
                var rect = $panel[0].getBoundingClientRect();
                var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
                var top = rect.top + scrollY - wpAdminBarOffset() - 12;
                animateScrollTo(Math.max(0, top), PREVIEW_SCROLL_MS);
            }
            if (typeof window.requestAnimationFrame === 'function') {
                window.requestAnimationFrame(function () {
                    window.requestAnimationFrame(run);
                });
            } else {
                run();
            }
        }, 16);
    }

    function mountLivePreview(options) {
        options = options || {};
        var $panel = $('#grwi-wp-live-preview');
        var $target = $('#grwi-wp-live-preview-target');
        if (!$panel.length || !$target.length) {
            return;
        }

        var place = selectedPlace || placeFromForm();
        if ((!place || !place.place_id) && previewingLockedLayout && previewDemo && previewDemo.place) {
            place = previewDemo.place;
        }
        if (!place || !place.place_id) {
            $panel.attr('hidden', true);
            return;
        }

        var layout = selectedLayout || $('#grwi-layout').val() || 'badge_card';
        applyPreviewFamily(layout);
        var reviews = livePreviewReviews();
        var useRealReviews = hasSyncedPreviewReviews && reviews.length > 0;

        function render() {
            if (!window.GrwPreview || typeof GrwPreview.mount !== 'function') {
                return;
            }
            $target.empty();
            // GrwPreview.mount replaces className — keep the stage class so admin.css centring/width rules survive.
            $target[0].setAttribute('data-preview-wrapper-class', 'grw-live-preview__target');
            try {
                var previewOpts = $.extend({}, previewConfigForLayout(layout), {
                    reviews: reviews,
                    maxReviews: Math.min(reviews.length || 1, 6)
                });
                if (useRealReviews) {
                    previewOpts.useSyncedReviews = true;
                    delete previewOpts.demoPhotos;
                    delete previewOpts.demo_photos;
                }
                GrwPreview.mount(
                    $target[0],
                    buildPreviewPlace(place, { layoutPickerPreview: !useRealReviews && !syncComplete }),
                    layout,
                    previewOpts
                );
                $panel.removeAttr('hidden');
                livePreviewMounted = true;
                if (options.scroll) {
                    scrollLivePreviewIntoView();
                }
            } catch (e) {
                $panel.attr('hidden', true);
            }
        }

        grwiWhenPreviewReady(render);
    }

    function renderReviewSync(place) {
        var $box = $('#grwi-review-sync');
        if (!$box.length) {
            return;
        }
        var notice = place && place.review_sync;
        if (!notice || !notice.lead) {
            $box.attr('hidden', true).empty();
            return;
        }
        var $lead = $('<p>', { 'class': 'grwi-review-sync__lead', text: notice.lead });
        var $line = $('<p>', { 'class': 'grwi-review-sync__line' });
        $line.text(notice.upgrade_line || '');
        if (notice.checkout_url && notice.cta_label) {
            $line.append(document.createTextNode(' '));
            $('<a>', {
                'class': 'grwi-review-sync__cta',
                href: notice.checkout_url,
                target: '_blank',
                rel: 'noopener noreferrer',
                text: notice.cta_label
            }).appendTo($line);
        }
        $box.empty().append($lead, $line).removeAttr('hidden');
    }

    function setSelectedPlace(place) {
        selectedPlace = place;
        $('#grwi-place-id').val(place.place_id || '');
        $('#grwi-business-name').val(place.business_name || place.name || '');
        $('#grwi-formatted-address').val(place.formatted_address || '');
        $('#grwi-rating').val(place.rating != null ? place.rating : '');
        $('#grwi-review-count').val(place.review_count != null ? place.review_count : '');
        $selectedText.text(place.business_name || place.name || '');
        $selected.removeAttr('hidden');
        $results.attr('hidden', true).empty();
        setResultsExpanded(false);
        $search.val('');
        persistRememberedPlace(place);
        renderRecentPlaces(cachedRecentPlaces);
        livePreviewMounted = false;
        resetSyncedPreview();
        mountLivePreview();
        showSyncNotice(place.business_name || place.name || '');
        renderReviewSync(place);
        triggerPlaceSync(place);
        clearPlaceRequiredError();
        syncCreateSubmitState();
    }

    function clearSelectedPlace() {
        selectedPlace = null;
        syncActivePlaceId = null;
        syncComplete = false;
        resetSyncedPreview();
        stopSyncPoll();
        searchSeq += 1;
        activeSearchQuery = '';
        if (searchRequest && searchRequest.abort) {
            searchRequest.abort();
            searchRequest = null;
        }
        setSearchBusy(false);
        $('#grwi-place-id, #grwi-business-name, #grwi-formatted-address, #grwi-rating, #grwi-review-count').val('');
        $selected.attr('hidden', true);
        $selectedText.text('');
        renderReviewSync(null);
        hideResults();
        $search.val('');
        $('#grwi-wp-live-preview').attr('hidden', true);
        livePreviewMounted = false;
        hideSyncNotice();
        hideSyncToast();
        renderRecentPlaces(cachedRecentPlaces);
        if ($search.length) {
            $search.trigger('focus');
        }
        syncCreateSubmitState();
    }

    function setSearchBusy(isBusy) {
        if ($searchWrap.length) {
            $searchWrap.toggleClass('grw-search--busy', isBusy);
        }
        if ($search.length) {
            $search.attr('aria-busy', isBusy ? 'true' : 'false');
        }
    }

    function setResultsExpanded(isExpanded) {
        if ($search.length) {
            $search.attr('aria-expanded', isExpanded ? 'true' : 'false');
        }
    }

    function hideResults() {
        $results.attr('hidden', true).empty();
        setResultsExpanded(false);
    }

    function formatRecentRating(place) {
        if (!place || place.rating == null || place.rating === '') {
            return '';
        }
        var rating = parseFloat(place.rating);
        if (!isFinite(rating) || rating <= 0) {
            return '';
        }
        return rating.toFixed(1) + '★';
    }

    function renderRecentPlaces(places) {
        if (!$recentPlaces.length || !$recentPlacesList.length) {
            return;
        }
        places = normalizePlacesList(places, {
            excludePlaceId: selectedPlace && selectedPlace.place_id
        });
        $recentPlacesList.empty();
        if (!places || !places.length) {
            $recentPlaces.attr('hidden', true);
            return;
        }
        places.forEach(function (place) {
            var $item = $('<div class="grw-recent-places__item" role="listitem"></div>');
            var $chip = $('<button type="button" class="grw-recent-places__chip"></button>');
            var $name = $('<span class="grw-recent-places__chip-name"></span>').text(place.business_name || place.name || '');
            $chip.append($name);
            var rating = formatRecentRating(place);
            if (rating) {
                $chip.append($('<span class="grw-recent-places__chip-rating" aria-hidden="true"></span>').text(rating));
            }
            $chip.on('click', function () {
                setSelectedPlace(place);
            });
            var $remove = $('<button type="button" class="grw-recent-places__remove">&times;</button>');
            $remove.attr('aria-label', (i18n.removeBusiness || 'Remove business') + ': ' + (place.business_name || place.name || ''));
            $remove.on('click', function (e) {
                e.preventDefault();
                e.stopPropagation();
                forgetRememberedPlace(place);
            });
            $item.append($chip).append($remove);
            $recentPlacesList.append($item);
        });
        $recentPlaces.removeAttr('hidden');
    }

    function persistRememberedPlace(place) {
        if (!place || !place.place_id) {
            return;
        }
        var id = placeIdKey(place);
        cachedRecentPlaces = [place].concat((cachedRecentPlaces || []).filter(function (row) {
            return placeIdKey(row) !== id;
        }));
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_remember_place',
            nonce: grwiAdmin.nonce,
            place_id: place.place_id,
            business_name: place.business_name || place.name || '',
            formatted_address: place.formatted_address || '',
            rating: place.rating != null ? place.rating : '',
            review_count: place.review_count != null ? place.review_count : ''
        }).done(function (response) {
            if (!response || !response.success) {
                return;
            }
            var data = response.data || {};
            if (data.places) {
                cachedRecentPlaces = data.places;
                renderRecentPlaces(cachedRecentPlaces);
            }
        });
    }

    function forgetRememberedPlace(place) {
        var id = placeIdKey(place);
        if (!id) {
            return;
        }
        cachedRecentPlaces = (cachedRecentPlaces || []).filter(function (row) {
            return placeIdKey(row) !== id;
        });
        renderRecentPlaces(cachedRecentPlaces);
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_forget_place',
            nonce: grwiAdmin.nonce,
            place_id: id
        }).done(function (response) {
            if (!response || !response.success) {
                return;
            }
            var data = response.data || {};
            if (data.places) {
                cachedRecentPlaces = data.places;
                renderRecentPlaces(cachedRecentPlaces);
            }
        });
        if (selectedPlace && placeIdKey(selectedPlace) === id) {
            clearSelectedPlace();
        }
    }

    function loadRecentPlaces() {
        if (!$recentPlaces.length || !$createForm.length) {
            return;
        }
        $.get(grwiAdmin.ajaxUrl, {
            action: 'grwi_recent_places',
            nonce: grwiAdmin.nonce
        }).done(function (response) {
            if (!response || !response.success) {
                return;
            }
            var data = response.data || {};
            cachedRecentPlaces = data.places || data.results || [];
            renderRecentPlaces(cachedRecentPlaces);
        });
    }

    function renderResults(places, query) {
        places = normalizePlacesList(places, {
            excludePlaceId: selectedPlace && selectedPlace.place_id
        });
        $results.empty();
        if (!places || !places.length) {
            if ((query || '').trim().length >= 3) {
                $results.append(
                    $('<p>', { 'class': 'grw-place-results__status grw-place-results__status--empty' })
                        .text(i18n.noResults || 'No businesses found.')
                );
                $results.removeAttr('hidden');
                setResultsExpanded(true);
            } else {
                hideResults();
            }
            return;
        }

        places.forEach(function (place) {
            var label = (place.business_name || place.name || '') + (place.formatted_address ? ' — ' + place.formatted_address : '');
            var $btn = $('<button type="button" role="option"></button>');
            $btn.text(label);
            $btn.on('click', function () {
                setSelectedPlace(place);
            });
            $results.append($btn);
        });
        $results.removeAttr('hidden');
        setResultsExpanded(true);
    }

    function renderSearching(query) {
        if ((query || '').trim().length < 3) {
            hideResults();
            return;
        }
        $results.empty().append(
            $('<p>', { 'class': 'grw-place-results__status' })
                .text(i18n.searching || 'Searching…')
        );
        $results.removeAttr('hidden');
        setResultsExpanded(true);
    }

    function searchPlaces(query) {
        var seq = ++searchSeq;
        activeSearchQuery = query;

        if (searchRequest && searchRequest.abort) {
            searchRequest.abort();
            searchRequest = null;
        }

        setSearchBusy(true);
        renderSearching(query);

        var searchHadFocus = $search.length && document.activeElement === $search[0];

        function customerFacingSearchMessage(msg) {
            var fallback = i18n.searchUnavailable || 'Business search is temporarily unavailable. Please try again later.';
            var text = String(msg || '');
            var lower = text.toLowerCase();
            if (
                !text
                || lower.indexOf('admin') >= 0
                || lower.indexOf('budget') >= 0
                || lower.indexOf('daily request') >= 0
                || lower.indexOf('api key') >= 0
                || lower.indexOf('.env') >= 0
                || lower.indexOf('google cloud') >= 0
            ) {
                return fallback;
            }
            return text;
        }

        searchRequest = $.ajax({
            url: grwiAdmin.ajaxUrl,
            method: 'GET',
            data: {
                action: 'grwi_search_places',
                nonce: grwiAdmin.nonce,
                q: query
            }
        }).done(function (response) {
            if (seq !== searchSeq || activeSearchQuery !== query) {
                return;
            }
            if (!response || !response.success) {
                var errMsg = customerFacingSearchMessage(
                    (response && response.data && response.data.message)
                    ? response.data.message
                        : (i18n.searchFailed || 'Search failed. Try again.')
                );
                $results.empty().append(
                    $('<p>', { 'class': 'grw-place-results__status grw-place-results__status--error' })
                        .text(errMsg)
                );
                $results.removeAttr('hidden');
                setResultsExpanded(true);
                return;
            }
            var data = response.data || {};
            renderResults(data.places || data.results || [], query);
        }).fail(function (xhr, status) {
            if (status === 'abort' || seq !== searchSeq || activeSearchQuery !== query) {
                return;
            }
            var failMsg = i18n.searchFailed || 'Search failed. Try again.';
            if (xhr && xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                failMsg = xhr.responseJSON.data.message;
            }
            $results.empty().append(
                $('<p>', { 'class': 'grw-place-results__status grw-place-results__status--error' })
                    .text(customerFacingSearchMessage(failMsg))
            );
            $results.removeAttr('hidden');
            setResultsExpanded(true);
        }).always(function () {
            if (seq !== searchSeq) {
                return;
            }
            setSearchBusy(false);
            searchRequest = null;
            if (searchHadFocus && $search.length && document.activeElement !== $search[0]) {
                $search.trigger('focus');
            }
        });
    }

    if ($search.length) {
        $search.on('input', function () {
            var query = String($search.val() || '').trim();
            clearTimeout(debounceTimer);
            if (query.length < 3) {
                searchSeq += 1;
                activeSearchQuery = '';
                if (searchRequest && searchRequest.abort) {
                    searchRequest.abort();
                    searchRequest = null;
                }
                setSearchBusy(false);
                hideResults();
                return;
            }
            debounceTimer = setTimeout(function () {
                searchPlaces(query);
            }, 400);
        });

        $search.on('focus', function () {
            var query = String($search.val() || '').trim();
            if (query.length >= 3 && $results.children().length) {
                $results.removeAttr('hidden');
                setResultsExpanded(true);
            }
        });
    }

    $('#grwi-clear-place').on('click', function (e) {
        e.preventDefault();
        clearSelectedPlace();
    });

    $('#grwi-sync-notice-dismiss').on('click', hideSyncNotice);
    $('#grwi-sync-notice-retry').on('click', function () {
        var place = selectedPlace || placeFromForm();
        if (place && place.place_id) {
            triggerPlaceSync(place);
        }
    });

    function hasSelectedBusiness() {
        return !!($('#grwi-place-id').val() || '').trim();
    }

    function clearPlaceRequiredError() {
        var $error = $('#grwi-place-error');
        $error.attr('hidden', true).text('');
        $search.removeClass('is-invalid').removeAttr('aria-invalid');
        $('#grwi-search-wrap').removeClass('is-invalid');
        $('#grwi-business-required-notice').attr('hidden', true);
    }

    function showPlaceRequiredError() {
        var message = i18n.selectBusinessContinue || i18n.selectBusiness || 'Select a business to continue';
        var $error = $('#grwi-place-error');
        $error.text(message).removeAttr('hidden');
        $search.addClass('is-invalid').attr('aria-invalid', 'true');
        $('#grwi-search-wrap').addClass('is-invalid');
        var $notice = $('#grwi-business-required-notice');
        if ($notice.length) {
            $notice.removeAttr('hidden');
        }
        var $field = $search.closest('.grw-field--place-search');
        if ($field.length && $field[0].scrollIntoView) {
            $field[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        $search.trigger('focus');
    }

    function syncCreateSubmitState() {
        if (!$submitBtn.length) {
            return;
        }
        var hasPlace = hasSelectedBusiness();
        var hint = i18n.selectBusinessContinue || 'Select a business to continue';
        $submitBtn.prop('disabled', !hasPlace);
        if (hasPlace) {
            $submitBtn.removeAttr('aria-disabled title');
            $('#grwi-create-business-hint').attr('hidden', true);
            clearPlaceRequiredError();
        } else {
            $submitBtn.attr('aria-disabled', 'true').attr('title', hint);
            $('#grwi-create-business-hint').removeAttr('hidden');
        }
    }

    if ($createForm.length) {
        loadRecentPlaces();
        syncCreateSubmitState();

        $createForm.on('submit', function (e) {
            e.preventDefault();

            if (!hasSelectedBusiness()) {
                showPlaceRequiredError();
                return;
            }

            if (previewingLockedLayout && previewingLockedEntitlement === 'linked_free' && !previewFirstEnabled()) {
                showLinkedFreeUnlockModal(selectedLayout, previewingLockedLabel);
                return;
            }

            if (previewingLockedLayout && !previewFirstEnabled()) {
                return;
            }

            setFormBusy(true);

            $.post(grwiAdmin.ajaxUrl, {
                action: 'grwi_create_widget',
                nonce: grwiAdmin.nonce,
                place_id: $('#grwi-place-id').val(),
                business_name: $('#grwi-business-name').val(),
                formatted_address: $('#grwi-formatted-address').val(),
                rating: $('#grwi-rating').val(),
                review_count: $('#grwi-review-count').val(),
                layout: $('#grwi-layout').val()
            }).done(function (response) {
                if (!response || !response.success) {
                    var createErr = (response && response.data && response.data.message)
                        ? response.data.message
                        : (i18n.createFailed || 'Could not create widget.');
                    showAdminNotice(createErr, 'error', response && response.data ? response.data.upgrade_url : '');
                    setFormBusy(false);
                    return;
                }

                var data = response.data || {};
                var customizeUrl = data.customize_url || '';
                if (customizeUrl) {
                    window.location.href = customizeUrl;
                    return;
                }

                var embedKey = data.embed_key || '';
                if (embedKey) {
                    var base = (window.grwiAdmin && grwiAdmin.dashboardUrl)
                        ? grwiAdmin.dashboardUrl
                        : (window.location.pathname + window.location.search.split('&grwi_')[0]);
                    var join = base.indexOf('?') >= 0 ? '&' : '?';
                    window.location.href = base + join + 'grwi_created=1&grwi_widget=' + encodeURIComponent(embedKey);
                    return;
                }

                showAdminNotice(i18n.created || 'Widget created successfully.', 'success');
                window.location.reload();
            }).fail(function (xhr) {
                var failMsg = i18n.createFailed || 'Could not create widget.';
                var upgradeUrl = '';
                if (xhr.responseJSON && xhr.responseJSON.data) {
                    if (xhr.responseJSON.data.message) {
                        failMsg = xhr.responseJSON.data.message;
                    }
                    upgradeUrl = xhr.responseJSON.data.upgrade_url || '';
                }
                showAdminNotice(failMsg, 'error', upgradeUrl);
                setFormBusy(false);
            });
        });
    }

    function syncLayoutSelection($card, options) {
        var key = $card.data('layout');
        clearLockedPreviewChrome();
        $('.grw-layout-card--selectable').removeClass('grw-layout-card--selected');
        $card.addClass('grw-layout-card--selected');
        $('#grwi-layout').val(key);
        selectedLayout = key;
        updateLayoutHint(key);
        mountLivePreview({ scroll: !(options && options.scroll === false) });
    }

    function updateLayoutHint(key) {
        $('#grwi-layout-hint').text('');
    }

    $('.grw-layout-card--selectable').on('click', function () {
        var $input = $(this).find('.grw-layout-card__input');
        $input.prop('checked', true);
        syncLayoutSelection($(this));
    });

    var PENDING_LAYOUT_KEY = 'grwi_pending_layout';

    function readPendingLayout() {
        try {
            var raw = window.localStorage.getItem(PENDING_LAYOUT_KEY);
            if (!raw) {
                return null;
            }
            var parsed = JSON.parse(raw);
            return parsed && typeof parsed === 'object' ? parsed : null;
        } catch (err) {
            return null;
        }
    }

    function writePendingLayout(payload) {
        try {
            window.localStorage.setItem(PENDING_LAYOUT_KEY, JSON.stringify(payload));
        } catch (err) {
            // ignore quota / private mode
        }
    }

    function clearPendingLayout() {
        try {
            window.localStorage.removeItem(PENDING_LAYOUT_KEY);
        } catch (err) {
            // ignore
        }
    }

    function readTrialEligible() {
        var adminCfg = window.grwiAdmin || {};
        if (!Object.prototype.hasOwnProperty.call(adminCfg, 'trialEligible')) {
            return adminCfg.isLinked ? true : null;
        }
        if (adminCfg.trialEligible === '' || adminCfg.trialEligible === null) {
            return null;
        }
        return adminCfg.trialEligible === true || adminCfg.trialEligible === 1 || adminCfg.trialEligible === '1';
    }

    function openTrialForLayout(layoutKey, planKey) {
        var adminCfg = window.grwiAdmin || {};
        var catalog = adminCfg.previewFirstCatalog || {};
        var trialEligible = readTrialEligible();
        var preferTrial = trialEligible !== false;
        planKey = planKey === 'business' || planKey === 'agency' || planKey === 'site'
            ? planKey
            : planKeyFromLabel(previewingLockedPlan);
        var urls = catalog.checkout_urls || {};
        var bags = catalog.trial || {};
        var base = urls[planKey]
            || (bags[planKey] && bags[planKey].checkout_url)
            || '';
        if (!base) {
            if (planKey === 'agency') {
                base = preferTrial
                    ? (adminCfg.agencyTrialUrl || adminCfg.trialUrl || '')
                    : (adminCfg.agencyUpgradeCheckoutUrl || adminCfg.upgradeCheckoutUrl || adminCfg.trialUrl || '');
            } else if (planKey === 'business') {
                base = preferTrial
                    ? (adminCfg.businessTrialUrl || adminCfg.trialUrl || '')
                    : (adminCfg.businessUpgradeCheckoutUrl || adminCfg.upgradeCheckoutUrl || adminCfg.trialUrl || '');
            } else {
                base = preferTrial
                    ? (adminCfg.trialUrl || adminCfg.upgradeCheckoutUrl || adminCfg.upgradeUrl || '')
                    : (adminCfg.upgradeCheckoutUrl || adminCfg.trialUrl || adminCfg.upgradeUrl || '');
            }
        }
        if (!base) {
            return;
        }
        var url = base;
        try {
            var parsed = new URL(base, window.location.origin);
            parsed.searchParams.set('plan', planKey);
            if (!parsed.searchParams.get('cycle')) {
                parsed.searchParams.set('cycle', 'monthly');
            }
            if (layoutKey) {
                parsed.searchParams.set('layout', layoutKey);
                if (planKey === 'site' && LAYOUT_FEATURE_SLUGS[layoutKey]) {
                    parsed.searchParams.set('feature', LAYOUT_FEATURE_SLUGS[layoutKey]);
                }
            }
            parsed.searchParams.set('source', 'wordpress');
            parsed.searchParams.set('return', window.location.href);
            url = parsed.toString();
        } catch (err) {
            // keep base
        }
            window.open(url, '_blank', 'noopener,noreferrer');
    }

    var activeConnectPollTimer = null;
    var activeConnectCloseWatcher = null;

    function abortConnectAttempt(message) {
        if (activeConnectPollTimer) {
            clearInterval(activeConnectPollTimer);
            activeConnectPollTimer = null;
        }
        if (activeConnectCloseWatcher) {
            clearInterval(activeConnectCloseWatcher);
            activeConnectCloseWatcher = null;
        }
        resetConnectUi($('[data-grwi-connect-account]').first(), message);
    }

    function startConnectFromLayout() {
        var $btn = $('[data-grwi-connect-account]').first();
        if ($btn.length) {
            // Allow retry after closing the popup without linking.
            abortConnectAttempt(i18n.connectHint || '');
            $btn.trigger('click');
            return;
        }
        var $account = $('.grw-account').first();
        if ($account.length) {
            $('html, body').animate({ scrollTop: $account.offset().top - 40 }, 200);
        }
    }

    function selectLayoutByKey(layoutKey) {
        if (!layoutKey) {
            return false;
        }
        var $card = $('.grw-layout-card--selectable[data-layout="' + layoutKey + '"]');
        if (!$card.length) {
            return false;
        }
        var $input = $card.find('.grw-layout-card__input');
        $input.prop('checked', true);
        syncLayoutSelection($card);
        return true;
    }

    function firstUnlockedLayoutCard() {
        return $('.grw-layout-card--selectable').first();
    }

    function ratingBadgeLayoutCard() {
        var $card = $('.grw-layout-card--selectable[data-layout="badge_card"]');
        if ($card.length) {
            return $card;
        }
        return firstUnlockedLayoutCard();
    }

    function scrollToLayoutSection(sectionKey) {
        var $section = $('.grw-create-form .grw-layout-category[data-layout-section="' + sectionKey + '"]').first();
        if (!$section.length) {
            $section = $('#grwi-layout-section-' + sectionKey);
        }
        if (!$section.length) {
            $section = $('.grw-create-form .grw-layout-category').first();
        }
        if (!$section.length || !$section[0]) {
            return;
        }
        var rect = $section[0].getBoundingClientRect();
        var scrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        var top = rect.top + scrollY - wpAdminBarOffset() - 12;
        animateScrollTo(Math.max(0, top), PREVIEW_SCROLL_MS);
    }

    function formatNamed(template, name) {
        var label = name || 'this layout';
        var str = String(template || '');
        if (str.indexOf('%s') >= 0) {
            return str.replace('%s', label);
        }
        return str;
    }

    function layoutFamilyFromKey(key) {
        var value = String(key || '');
        if (value.indexOf('feed_') === 0) {
            return 'feed';
        }
        if (value.indexOf('sticker_') === 0) {
            return 'sticker';
        }
        return 'badge';
    }

    function applyPreviewFamily(layout) {
        var $panel = $('#grwi-wp-live-preview');
        if (!$panel.length) {
            return;
        }
        $panel
            .removeClass('grw-live-preview--family-badge grw-live-preview--family-sticker grw-live-preview--family-feed')
            .addClass('grw-live-preview--family-' + layoutFamilyFromKey(layout));
    }

    function siteWidgetCount() {
        var rows = $('.grw-widget-row').length;
        if (rows > 0) {
            return rows;
        }
        var attr = parseInt($('.grw-admin').attr('data-widget-count') || '0', 10);
        return isFinite(attr) && attr > 0 ? attr : 0;
    }

    function otherLockedCount(entitlement, layoutKey) {
        var $cards = $('.grw-layout-card--locked[data-entitlement="' + entitlement + '"]');
        if (layoutKey) {
            $cards = $cards.not('[data-layout="' + layoutKey + '"]');
        }
        return $cards.length;
    }

    function planKeyFromLabel(plan) {
        var value = String(plan || 'Site').toLowerCase();
        if (value === 'business') {
            return 'business';
        }
        if (value === 'agency') {
            return 'agency';
        }
        return 'site';
    }

    function paidLayoutNoticeTitle(planKey) {
        if (planKey === 'business') {
            return i18n.lockedPreviewNoticeBusiness || 'Business plan required';
        }
        if (planKey === 'agency') {
            return i18n.lockedPreviewNoticeAgency || 'Agency plan required';
        }
        return i18n.lockedPreviewNoticeSite || 'Site plan required';
    }

    function paidLayoutNoticeBody(planKey, layoutLabel) {
        var trialEligible = readTrialEligible();
        if (trialEligible === false) {
            if (planKey === 'business') {
                return formatNamed(
                    i18n.lockedPreviewNoticeBusinessBodyIneligible || 'Upgrade to Business to use %s.',
                    layoutLabel
                );
            }
            return formatNamed(
                i18n.lockedPreviewNoticeSiteBodyIneligible || 'Upgrade to Site to use %s.',
                layoutLabel
            );
        }
        return formatNamed(
            i18n.lockedPreviewNoticeSiteBody || 'Start a 7-day trial to use %s immediately.',
            layoutLabel
        );
    }

    function paidLayoutCtaLabel(planKey, layoutLabel) {
        var template;
        if (planKey === 'business') {
            template = i18n.lockedPreviewCtaBusiness || 'View Business plan to use %s';
        } else if (planKey === 'agency') {
            template = i18n.lockedPreviewCtaAgency || 'View Agency plan to use %s';
        } else {
            template = i18n.lockedPreviewCtaSite || 'View Site plan to use %s';
        }
        return formatNamed(template, layoutLabel);
    }

    function paidLayoutSupporting(planKey) {
        var trialEligible = readTrialEligible();
        var bags = (window.grwiAdmin && grwiAdmin.trialCopy) ? grwiAdmin.trialCopy : {};
        var bag = bags[planKey] || bags.site || {};
        if (trialEligible === false) {
            return bag.ineligible_supporting || i18n.trialIneligibleSupporting || 'Charged at checkout. Cancel anytime.';
        }
        return i18n.lockedPreviewTrialLead || '7-day trial · No charge today · Card required at checkout';
    }

    function linkSupportingCopy() {
        var parts = [i18n.lockedPreviewLinkSupporting || 'Free · About 20 seconds'];
        if (siteWidgetCount() > 0) {
            parts.push(i18n.lockedPreviewWidgetsUnchanged || 'Existing widgets remain unchanged');
        }
        return parts.join(' · ');
    }

    function railBodyFor(entitlement, layoutKey) {
        var others = otherLockedCount(entitlement, layoutKey);
        if (entitlement === 'linked_free') {
            if (others <= 0) {
                return i18n.previewRailLinkBodyOnly || 'Link a free account to unlock this layout.';
            }
            if (others === 1) {
                return i18n.previewRailLinkBodyOne || 'Link a free account to unlock this and 1 other layout.';
            }
            return String(i18n.previewRailLinkBody || 'Link a free account to unlock this and %d other layouts.').replace('%d', String(others));
        }
        if (others <= 0) {
            return i18n.previewRailSiteBodyOnly || 'Start a 7-day trial to use this layout immediately.';
        }
        if (others === 1) {
            return i18n.previewRailSiteBodyOne || 'Start a 7-day trial to use this and 1 other layout immediately.';
        }
        return String(i18n.previewRailSiteBody || 'Start a 7-day trial to use this and %d other layouts immediately.').replace('%d', String(others));
    }

    function setPreviewRail(entitlement, layoutLabel, layoutKey, ctaLabel) {
        var $rail = $('#grwi-preview-rail');
        var $title = $('#grwi-preview-rail-title');
        var $body = $('#grwi-preview-rail-body');
        var $cta = $('#grwi-preview-rail-cta');
        var $sidebar = $('.grw-sidebar').first();
        if (!$rail.length) {
            return;
        }
        var isLink = entitlement === 'linked_free';
        $rail
            .toggleClass('grw-preview-rail--link', isLink)
            .toggleClass('grw-preview-rail--paid', !isLink);
        $title.text(formatNamed(i18n.previewRailTitle || '%s selected for preview', layoutLabel));
        $body.text(railBodyFor(entitlement, layoutKey));
        $cta.text(ctaLabel);
        $rail.removeAttr('hidden');
        $sidebar.addClass('is-previewing-locked');
    }

    function clearPreviewRail() {
        var $rail = $('#grwi-preview-rail');
        $('.grw-sidebar').first().removeClass('is-previewing-locked');
        if (!$rail.length) {
            return;
        }
        $rail.attr('hidden', true).removeClass('grw-preview-rail--link grw-preview-rail--paid');
        $('#grwi-preview-rail-title').text('');
        $('#grwi-preview-rail-body').text('');
        $('#grwi-preview-rail-cta').text('');
    }

    function setLockedPreviewChrome(entitlement, planLabel, layoutLabel, layoutKey) {
        var $panel = $('#grwi-wp-live-preview');
        var $notice = $('#grwi-live-preview-notice');
        var $noticeTitle = $('#grwi-live-preview-notice-title');
        var $noticeText = $('#grwi-live-preview-notice-text');
        var $submitWrap = $('#grwi-create-submit-wrap');
        var $pickAnother = $('#grwi-pick-another-layout');
        var $ctaWrap = $('#grwi-locked-preview-cta-wrap');
        var $ctaLabel = $('#grwi-locked-preview-cta-label');
        var $supporting = $('#grwi-locked-preview-supporting-text');
        var $previewTitle = $('#grwi-live-preview-title');
        var isLink = entitlement === 'linked_free';
        var planKey = planKeyFromLabel(planLabel);
        var tone = isLink ? 'link' : 'paid';
        var name = layoutLabel || 'this layout';
        var ctaText;

        previewingLockedLayout = true;
        previewingLockedEntitlement = entitlement;
        previewingLockedPlan = planLabel || 'Site';
        previewingLockedLabel = name;

        $createForm.addClass('grw-create-form--locked-preview');
        $panel.addClass('grw-live-preview--locked').attr('data-lock-tone', tone);
        $submitWrap.addClass('is-locked-preview').attr('data-lock-tone', tone);
        $notice.attr('data-lock-tone', tone);
        $('#grwi-live-preview-sub').attr('hidden', true);
        $previewTitle.text(formatNamed(i18n.previewingHeading || 'Previewing: %s', name));

        if (isLink) {
            $noticeTitle.text(i18n.lockedPreviewNoticeLink || 'Free account required');
            $noticeText.text(formatNamed(
                i18n.lockedPreviewNoticeLinkBody || 'Link a free account to use %s. No card required.',
                name
            ));
            ctaText = formatNamed(i18n.lockedPreviewCtaLink || 'Link free account to use %s', name);
            $ctaLabel.text(ctaText);
            $supporting.text(linkSupportingCopy());
        } else if (previewFirstEnabled()) {
            $noticeTitle.text(formatNamed(i18n.previewFirstBannerTitle || 'Your design uses %s features', planLabel || 'Site'));
            $noticeText.text(
                (i18n.previewFirstBannerBodySingular || '%1$s requires %2$s to publish. Keep designing for free—your current live widget won’t change.')
                    .replace('%1$s', name)
                    .replace('%2$s', planLabel || 'Site')
            );
            ctaText = paidLayoutCtaLabel(planKey, name);
            $ctaLabel.text(ctaText);
            $supporting.text(paidLayoutSupporting(planKey));
        } else {
            $noticeTitle.text(paidLayoutNoticeTitle(planKey));
            $noticeText.text(paidLayoutNoticeBody(planKey, name));
            ctaText = paidLayoutCtaLabel(planKey, name);
            $ctaLabel.text(ctaText);
            $supporting.text(paidLayoutSupporting(planKey));
        }

        $notice.removeAttr('hidden');
        $pickAnother.removeAttr('hidden');
        $ctaWrap.removeAttr('hidden');
        if (!previewFirstEnabled()) {
            $submitBtn.attr('hidden', true);
        } else {
            $submitBtn.removeAttr('hidden');
            $('#grwi-layout').val(layoutKey);
        }
        setPreviewRail(entitlement, name, layoutKey, ctaText);
    }

    function clearLockedPreviewChrome() {
        if (!previewingLockedLayout && !$createForm.hasClass('grw-create-form--locked-preview')) {
            $('.grw-layout-card--locked').removeClass('grw-layout-card--previewing').removeAttr('aria-pressed');
            clearPreviewRail();
            return;
        }
        previewingLockedLayout = false;
        previewingLockedEntitlement = '';
        previewingLockedPlan = 'Site';
        previewingLockedLabel = '';
        lockedPreviewScrollY = null;
        $createForm.removeClass('grw-create-form--locked-preview');
        $('#grwi-wp-live-preview').removeClass('grw-live-preview--locked').removeAttr('data-lock-tone');
        $('#grwi-create-submit-wrap').removeClass('is-locked-preview').removeAttr('data-lock-tone');
        $('#grwi-live-preview-notice').attr('hidden', true).removeAttr('data-lock-tone');
        $('#grwi-live-preview-notice-title').text('');
        $('#grwi-live-preview-notice-text').text('');
        $('#grwi-live-preview-title').text(i18n.livePreview || 'Live preview');
        $('#grwi-live-preview-sub').removeAttr('hidden');
        $('#grwi-pick-another-layout').attr('hidden', true);
        $('#grwi-locked-preview-cta-wrap').attr('hidden', true);
        $('#grwi-locked-preview-supporting-text').text('');
        $submitBtn.removeAttr('hidden');
        $('.grw-layout-card--locked').removeClass('grw-layout-card--previewing').removeAttr('aria-pressed');
        clearPreviewRail();
    }

    function cannotCreateMoreWidgets() {
        return $('.grw-admin').first().attr('data-can-create') === '0';
    }

    function previewLockedLayout($card) {
        if (!$card || !$card.length) {
            return;
        }
        // Included layouts already use the allowance modal when the widget
        // limit is reached; locked layouts must do the same (no live preview).
        if (cannotCreateMoreWidgets()) {
            showWidgetAllowanceModal();
            return;
        }
        var layoutKey = $card.data('layout') || '';
        var layoutLabel = $card.data('layout-label') || $card.find('.grw-layout-card__label').text() || layoutKey;
        var entitlement = normalizeEntitlement($card.data('entitlement') || $card.data('lock-tier') || 'site');
        var planLabel = $card.data('upgrade-plan') || (entitlement === 'linked_free' ? '' : (entitlement === 'business' ? 'Business' : 'Site'));

        lockedPreviewScrollY = window.pageYOffset || document.documentElement.scrollTop || 0;
        closeUnlockModal();
        $('.grw-layout-card--selectable').removeClass('grw-layout-card--selected');
        $('.grw-layout-card--locked').removeClass('grw-layout-card--previewing').removeAttr('aria-pressed');
        $card.addClass('grw-layout-card--previewing').attr('aria-pressed', 'true');
        selectedLayout = layoutKey;
        $('#grwi-layout').val(layoutKey);
        setLockedPreviewChrome(entitlement, planLabel, layoutLabel, layoutKey);
        mountLivePreview({ scroll: true });
        if (previewFirstEnabled() && entitlement !== 'linked_free' && !paidLayoutToastShown) {
            paidLayoutToastShown = true;
            var planName = planLabel || 'Site';
            showPreviewFirstToast(
                layoutLabel + ' selected',
                formatNamed(i18n.previewFirstToastBody || 'Preview and customise it freely. You’ll need %s to publish this design.', planName)
            );
        }
    }

    function chooseFirstUnlockedLayout() {
        var $card = ratingBadgeLayoutCard();
        if (!$card.length) {
            clearLockedPreviewChrome();
            return false;
        }
        var $input = $card.find('.grw-layout-card__input');
        $input.prop('checked', true);
        syncLayoutSelection($card, { scroll: false });
        scrollToLayoutSection('badges');
        if ($card[0] && typeof $card[0].focus === 'function') {
            try {
                $card[0].focus({ preventScroll: true });
            } catch (err) {
                $card.trigger('focus');
            }
        }
        return true;
    }

    function normalizeEntitlement(value) {
        if (value === 'link_account') {
            return 'linked_free';
        }
        if (value === 'linked_free' || value === 'site' || value === 'unlinked' || value === 'business') {
            return value;
        }
        return value || 'site';
    }

    var $unlockModal = $('#grwi-unlock-modal');
    var unlockModalState = null;
    var unlockModalLastFocus = null;

    function closeUnlockModal() {
        if (!$unlockModal.length) {
            return;
        }
        $unlockModal.attr('hidden', true);
        $unlockModal.removeClass('grw-unlock-modal--linked_free grw-unlock-modal--site grw-unlock-modal--business');
        $('body').removeClass('grw-modal-open');
        if (unlockModalLastFocus && unlockModalLastFocus.focus) {
            try { unlockModalLastFocus.focus(); } catch (err) { /* ignore */ }
        }
        unlockModalState = null;
    }

    function openUnlockModal(config) {
        if (!$unlockModal.length) {
            return;
        }
        unlockModalState = config || {};
        unlockModalLastFocus = document.activeElement;
        var i18n = (window.grwiAdmin && grwiAdmin.i18n) ? grwiAdmin.i18n : {};
        var mode = config.mode || 'linked_free';
        $unlockModal
            .removeClass('grw-unlock-modal--linked_free grw-unlock-modal--site grw-unlock-modal--business')
            .addClass('grw-unlock-modal--' + (mode === 'business' ? 'business' : (mode === 'site' ? 'site' : 'linked_free')));
        $('#grwi-unlock-modal-title').text(config.title || '');
        $('#grwi-unlock-modal-body').text(config.body || '');
        var $supporting = $('#grwi-unlock-modal-supporting');
        if (config.supporting) {
            $supporting.text(config.supporting).prop('hidden', false);
        } else {
            $supporting.text('').prop('hidden', true);
        }
        $('#grwi-unlock-modal-primary').text(config.primaryLabel || (i18n.linkLayoutCta || 'Continue'));
        $('#grwi-unlock-modal-secondary').text(config.secondaryLabel || (i18n.linkLayoutSecondary || 'Cancel'));
        var $footer = $('#grwi-unlock-modal-footer');
        if (config.footer) {
            $footer.text(config.footer).prop('hidden', false);
        } else {
            $footer.text('').prop('hidden', true);
        }
        var $note = $('#grwi-unlock-modal-note');
        if ($note.length) {
            if (config.linkOnlyNote) {
                $note.text(config.linkOnlyNote).prop('hidden', false);
            } else {
                $note.text('').prop('hidden', true);
            }
        }
        var $linkOnly = $('#grwi-unlock-modal-link-only');
        if ($linkOnly.length) {
            if (config.linkOnlyLabel) {
                $linkOnly.text(config.linkOnlyLabel).prop('hidden', false);
            } else {
                $linkOnly.text('').prop('hidden', true);
            }
        }
        $unlockModal.removeAttr('hidden');
        $('body').addClass('grw-modal-open');
        $('#grwi-unlock-modal-primary').trigger('focus');
    }

    function showLinkedFreeUnlockModal(layoutKey, layoutLabel) {
        var i18n = (window.grwiAdmin && grwiAdmin.i18n) ? grwiAdmin.i18n : {};
        openUnlockModal({
            mode: 'linked_free',
            layout: layoutKey,
            title: (i18n.linkLayoutTitle || 'Unlock %s with a free account').replace('%s', layoutLabel),
            body: i18n.linkLayoutBody || 'Link a free GR Widget account to unlock this layout, 3 widgets, 10 reviews and the web dashboard.',
            primaryLabel: i18n.linkLayoutCta || 'Create or link free account',
            secondaryLabel: i18n.linkLayoutSecondary || 'Continue with current layout',
            footer: i18n.linkLayoutFooter || 'No payment required',
            onPrimary: function () {
                writePendingLayout({ layout: layoutKey, entitlement: 'linked_free', openTrial: false });
                closeUnlockModal();
                startConnectFromLayout();
            }
        });
    }

    function showWidgetAllowanceModal() {
        var i18n = (window.grwiAdmin && grwiAdmin.i18n) ? grwiAdmin.i18n : {};
        var isLinked = !!(window.grwiAdmin && grwiAdmin.isLinked);
        if (isLinked) {
            openUnlockModal({
                mode: 'site',
                title: i18n.widgetAllowanceTitle || 'Widget limit reached',
                body: i18n.widgetAllowanceLinkedBody || 'Upgrade on GRWidget.com for more widgets and every layout.',
                primaryLabel: i18n.widgetAllowanceLinkedCta || 'Start free trial',
                secondaryLabel: i18n.widgetAllowanceSecondary || 'Not now',
                onPrimary: function () {
                    closeUnlockModal();
                    openTrialForLayout('');
                }
            });
            return;
        }
        openUnlockModal({
            mode: 'linked_free',
            title: i18n.widgetAllowanceTitle || 'Widget limit reached',
            body: i18n.widgetAllowanceBody || 'Link a free GR Widget account to create more widgets and unlock extra layouts.',
            primaryLabel: i18n.widgetAllowanceCta || 'Link free account',
            secondaryLabel: i18n.widgetAllowanceSecondary || 'Not now',
            footer: i18n.linkLayoutFooter || 'No payment required',
            onPrimary: function () {
                closeUnlockModal();
                startConnectFromLayout();
            }
        });
    }

    function showPreviewFirstPublishModal(layoutKey, layoutLabel) {
        var bags = (window.grwiAdmin && grwiAdmin.trialCopy) ? grwiAdmin.trialCopy : {};
        var catalog = (window.grwiAdmin && grwiAdmin.previewFirstCatalog) ? grwiAdmin.previewFirstCatalog : {};
        var trial = catalog.trial || {};
        var planKey = planKeyFromLabel(previewingLockedPlan);
        var bag = bags[planKey] || trial[planKey] || bags.site || trial.site || {};
        var trialEligible = readTrialEligible();
        var planName = (catalog.plan_names && catalog.plan_names[planKey]) || previewingLockedPlan || 'Site';
        var price = bag.price_label || '';
        var cycle = bag.cycle_label || '/month';
        var days = bag.days || (trial.days) || 7;
        var body;
        if (trialEligible === false) {
            body = layoutLabel + ' require ' + planName + '. Upgrade to publish this version'
                + (price ? ('—' + price + cycle) : '') + '.';
        } else {
            body = layoutLabel + ' require ' + planName + '. Start a ' + days
                + '-day free trial to publish this version—no charge today, then '
                + (price ? (price + cycle) : 'the listed plan price') + '.';
        }
        openUnlockModal({
            mode: planKey === 'business' ? 'business' : 'site',
            layout: layoutKey,
            title: formatNamed(i18n.previewFirstPublishTitle || 'Your %s design is ready', layoutLabel),
            body: body,
            supporting: trialEligible === false ? (bag.ineligible_supporting || '') : (bag.eligible_supporting || ''),
            primaryLabel: trialEligible === false
                ? (i18n.customizeUpgradeCta || ('Upgrade to ' + planName))
                : (i18n.previewFirstStartTrial || 'Start my free trial'),
            secondaryLabel: i18n.previewFirstContinueEditing || 'Continue editing',
            footer: trialEligible === true ? (i18n.siteLayoutFooter || 'Cancel anytime during the trial') : '',
            onPrimary: function () {
                closeUnlockModal();
                openTrialForLayout(layoutKey);
            }
        });
    }

    function showSiteTrialModal(layoutKey, layoutLabel) {
        var i18n = (window.grwiAdmin && grwiAdmin.i18n) ? grwiAdmin.i18n : {};
        var isLinked = !!(window.grwiAdmin && grwiAdmin.isLinked);
        var trialEligible = window.grwiAdmin && Object.prototype.hasOwnProperty.call(grwiAdmin, 'trialEligible')
            ? (grwiAdmin.trialEligible === '' || grwiAdmin.trialEligible === null ? null : !!(grwiAdmin.trialEligible === true || grwiAdmin.trialEligible === 1 || grwiAdmin.trialEligible === '1'))
            : (isLinked ? true : null);
        var body = (i18n.siteLayoutBody || 'Display your reviews using the %s. Site also includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.').replace('%s', layoutLabel);
        var supporting = trialEligible === null
            ? (i18n.trialUnknownSupporting || 'Trial eligibility will be confirmed before payment.')
            : (trialEligible
                ? (i18n.siteLayoutSupporting || '')
                : (i18n.trialIneligibleSupporting || 'Charged at checkout. Cancel anytime.'));
        var primaryLabel = trialEligible === null
            ? (isLinked ? 'Sign in to continue' : 'View Site plan')
            : (trialEligible
                ? (i18n.siteLayoutCta || 'Start 7-day Site trial')
                : (i18n.customizeUpgradeCta || i18n.siteLayoutCta || 'Upgrade to Site'));
        openUnlockModal({
            mode: 'site',
            layout: layoutKey,
            title: (i18n.siteLayoutTitle || 'Unlock %s with Site').replace('%s', layoutLabel),
            body: body,
            supporting: supporting,
            primaryLabel: primaryLabel,
            secondaryLabel: isLinked
                ? (i18n.siteLayoutSecondary || 'Continue with current layout')
                : 'Compare plans',
            footer: trialEligible === true ? (i18n.siteLayoutFooter || 'Cancel anytime during the trial') : '',
            linkOnlyLabel: !isLinked ? 'Link free account only' : '',
            linkOnlyNote: !isLinked ? 'Linking a free account does not unlock this Site feature.' : '',
            onPrimary: function () {
                closeUnlockModal();
                openTrialForLayout(layoutKey);
            },
            onSecondary: function () {
                if (!isLinked) {
                    var compare = (window.grwiAdmin && grwiAdmin.comparePlansUrl) ? grwiAdmin.comparePlansUrl : 'https://grwidget.com/pricing?source=wordpress';
                    window.open(compare, '_blank', 'noopener,noreferrer');
                }
                closeUnlockModal();
            },
            onLinkOnly: function () {
                closeUnlockModal();
                writePendingLayout({ layout: layoutKey, entitlement: 'site', openTrial: true });
                startConnectFromLayout();
            }
        });
    }

    if ($unlockModal.length) {
        $unlockModal.on('click', '[data-grw-unlock-close]', function (e) {
            e.preventDefault();
            closeUnlockModal();
        });
        $('#grwi-unlock-modal-primary').on('click', function (e) {
            e.preventDefault();
            if (unlockModalState && typeof unlockModalState.onPrimary === 'function') {
                unlockModalState.onPrimary();
            }
        });
        $('#grwi-unlock-modal-secondary').on('click', function (e) {
            e.preventDefault();
            if (unlockModalState && typeof unlockModalState.onSecondary === 'function') {
                unlockModalState.onSecondary();
            } else {
                closeUnlockModal();
            }
        });
        $('#grwi-unlock-modal-link-only').on('click', function (e) {
            e.preventDefault();
            if (unlockModalState && typeof unlockModalState.onLinkOnly === 'function') {
                unlockModalState.onLinkOnly();
            } else {
                closeUnlockModal();
            }
        });
        $(document).on('keydown.grwiUnlockModal', function (e) {
            if (e.key === 'Escape' && $unlockModal.length && !$unlockModal.is('[hidden]')) {
                closeUnlockModal();
            }
        });
    }

    $(document).on('submit', '#grwi-unlink-form', function (e) {
        if (this.getAttribute('data-grwi-confirmed') === '1') {
            return;
        }
        e.preventDefault();
        var form = this;
        openUnlockModal({
            mode: 'linked_free',
            title: i18n.unlinkTitle || 'Unlink this site?',
            body: i18n.unlinkBody || 'Unlink this site from your GR Widget account? Your widgets stay in this plugin; link again later to manage them in the web builder.',
            primaryLabel: i18n.unlinkConfirm || 'Unlink account',
            secondaryLabel: i18n.cancel || 'Cancel',
            onPrimary: function () {
                form.setAttribute('data-grwi-confirmed', '1');
                // The unlink control used to be named "submit", which replaces
                // form.submit with the button. Always call the prototype method.
                HTMLFormElement.prototype.submit.call(form);
            },
            onSecondary: function () {
                closeUnlockModal();
            }
        });
    });

    $(document).on('click', '[data-grwi-toast-close]', function (e) {
        e.preventDefault();
        hidePreviewFirstToast();
    });
    $(document).on('click', '[data-grwi-dismiss-business-notice]', function (e) {
        e.preventDefault();
        $('#grwi-business-required-notice').attr('hidden', true);
    });
    $(document).on('keydown.grwiBusinessNotice', function (e) {
        if (e.key === 'Escape' && $('#grwi-business-required-notice').length && !$('#grwi-business-required-notice').is('[hidden]')) {
            $('#grwi-business-required-notice').attr('hidden', true);
        }
    });
    $(document).on('keydown.grwiPreviewFirstToast', function (e) {
        if (e.key === 'Escape' && $('#grwi-preview-first-toast').length && !$('#grwi-preview-first-toast').is('[hidden]')) {
            hidePreviewFirstToast();
        }
    });

    function applyPendingLayoutAfterLoad() {
        var pending = readPendingLayout();
        if (!pending || !pending.layout) {
            return;
        }
        var layoutKey = pending.layout;
        clearPendingLayout();
        if (selectLayoutByKey(layoutKey)) {
            return true;
        }
        var $locked = $('.grw-layout-card--locked[data-layout="' + layoutKey + '"]');
        if ($locked.length) {
            previewLockedLayout($locked);
            return true;
        }
        return false;
    }

    function onLockedLayoutCard(e) {
        if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
            return;
        }
        if (e) {
            e.preventDefault();
        }
        if (cannotCreateMoreWidgets()) {
            showWidgetAllowanceModal();
            return;
        }
        if (!hasSelectedBusiness()) {
            showPlaceRequiredError();
            return;
        }
        previewLockedLayout($(this));
    }

    $('.grw-layout-card--locked').on('click', onLockedLayoutCard);
    $('.grw-layout-card--locked').on('keydown', onLockedLayoutCard);

    $('#grwi-pick-another-layout').on('click', function (e) {
        e.preventDefault();
        chooseFirstUnlockedLayout();
    });

    $('#grwi-locked-preview-cta, #grwi-preview-rail-cta').on('click', function (e) {
        e.preventDefault();
        var layoutKey = selectedLayout || '';
        if (previewingLockedEntitlement === 'linked_free') {
            writePendingLayout({ layout: layoutKey, entitlement: 'linked_free', openTrial: false });
            startConnectFromLayout();
            return;
        }
        openTrialForLayout(layoutKey);
    });

    function onBrowseLayoutCard(e) {
        if (e && e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') {
            return;
        }
        if (e) {
            e.preventDefault();
        }
        showWidgetAllowanceModal();
    }

    $('.grw-layout-card--browse').on('click', onBrowseLayoutCard);
    $('.grw-layout-card--browse').on('keydown', onBrowseLayoutCard);

    $('.grw-layout-card--selectable .grw-layout-card__input').on('change', function () {
        if (this.checked) {
            syncLayoutSelection($(this).closest('.grw-layout-card--selectable'));
        }
    });

    var initialLayout = $('#grwi-layout').val();
    if (initialLayout) {
        selectedLayout = initialLayout;
        updateLayoutHint(initialLayout);
    }

    applyPendingLayoutAfterLoad();

    if ($('#grwi-place-id').val()) {
        selectedPlace = placeFromForm();
        mountLivePreview();
    }

    var $widgetPreviewModal = $('#grwi-widget-preview-modal');
    var widgetPreviewRequestId = 0;
    var WIDGET_PREVIEW_MOUNT_CLASS = 'grw-widget-preview-modal__mount';
    var $widgetPreviewMount = $();
    var $widgetPreviewLoading = $();

    if ($widgetPreviewModal.length) {
        $widgetPreviewMount = $widgetPreviewModal.find('#grwi-widget-preview-mount, .' + WIDGET_PREVIEW_MOUNT_CLASS).first();
        $widgetPreviewLoading = $widgetPreviewModal.find('.grw-widget-preview-modal__loading').first();
    }

    function isWidgetPreviewModalMount($mount) {
        return $widgetPreviewMount.length && $mount.length && $mount[0] === $widgetPreviewMount[0];
    }

    function clearGrwPreviewElementState(el) {
        if (!el) {
            return;
        }
        if (el.__grwPreviewCarouselTimer) {
            clearInterval(el.__grwPreviewCarouselTimer);
            el.__grwPreviewCarouselTimer = null;
        }
        if (el.__grwPreviewShowcaseTimer) {
            clearInterval(el.__grwPreviewShowcaseTimer);
            el.__grwPreviewShowcaseTimer = null;
        }
        delete el.__grwLightboxReviews;
        delete el.__grwLightboxOpts;
        delete el.__grwLightboxPlace;
        delete el.__grwDrawerReviews;
        delete el.__grwPhotoLightboxWired;
        delete el.__grwDrawerCloseWired;
    }

    function destroyWidgetPreviewMount($mount) {
        if (!$mount || !$mount.length) {
            return;
        }
        var el = $mount[0];
        var modalMount = isWidgetPreviewModalMount($mount);
        clearGrwPreviewElementState(el);
        $mount.empty()
            .removeAttr('data-grw-layout-picker-preview')
            .removeAttr('data-grw-mounted')
            .removeAttr('data-layout')
            .removeAttr('data-preview-theme')
            .removeAttr('data-preview-variant')
            .removeClass('grw-mock wb-preview-placeholder')
            .removeData('grw-mounted');
        if (el) {
            if (modalMount) {
                el.className = WIDGET_PREVIEW_MOUNT_CLASS;
                el.removeAttribute('data-preview-wrapper-class');
            } else {
                el.className = '';
                el.removeAttribute('style');
            }
        }
    }

    function prepareWidgetPreviewModalMount() {
        if (!$widgetPreviewMount.length) {
            return;
        }
        destroyWidgetPreviewMount($widgetPreviewMount);
        prepareSavedWidgetPreviewMount($widgetPreviewMount[0], WIDGET_PREVIEW_MOUNT_CLASS);
    }

    function resetWidgetPreviewModalLayers() {
        if (!$widgetPreviewModal.length) {
            return;
        }
        destroyWidgetPreviewMount($widgetPreviewMount);
        $widgetPreviewMount.attr('hidden', true);
        $widgetPreviewLoading.attr('hidden', true);
    }

    function mountEmbedPreview($mount, embedKey, requestId, onComplete) {
        if (!$mount || !$mount.length) {
            if (typeof onComplete === 'function') {
                onComplete(false);
            }
            return;
        }

        function isStale() {
            return requestId !== widgetPreviewRequestId;
        }

        var key = embedKey || $mount.data('embed-key') || $mount.data('grwidget-key') || $mount.data('grwi-embed-key') || '';
        if (!key) {
            if (!isStale() && typeof onComplete === 'function') {
                onComplete(false);
            }
            return;
        }

        function renderFromPayload(data) {
            if (isStale()) {
                return;
            }
            destroyWidgetPreviewMount($mount);
            var ok = mountSavedWidgetPreviewFromPayload($mount[0], data);
            if (isStale()) {
                destroyWidgetPreviewMount($mount);
                return;
            }
            if (ok) {
                $mount.data('grw-mounted', true);
            }
            if (typeof onComplete === 'function') {
                onComplete(ok);
            }
        }

        var run = function () {
            if (isStale()) {
                return;
            }
            loadSavedDashboardPreview(key)
                .then(function (data) {
                    if (!data || isStale()) return;
                    $widgetPreviewModal.find('[data-grwi-saved-preview-label]').text(savedPreviewLabel(data)).prop('hidden',data.preview_state !== 'draft');
                    renderFromPayload(data);
                })
                .catch(function () {
                    if (!isStale() && typeof onComplete === 'function') {
                        onComplete(false);
                    }
                });
        };

        if (!grwiWhenPreviewReady(function () {
            if (!isStale()) {
                run();
            }
        }) && !isStale() && typeof onComplete === 'function') {
            onComplete(false);
        }
    }

    var widgetPreviewLastFocus = null;

    function closeWidgetPreviewModal() {
        if (!$widgetPreviewModal.length) {
            return;
        }
        widgetPreviewRequestId += 1;
        $widgetPreviewModal.attr('hidden', true);
        $('body').removeClass('grw-modal-open');
        resetWidgetPreviewModalLayers();
        if (widgetPreviewLastFocus && widgetPreviewLastFocus.length) {
            widgetPreviewLastFocus.trigger('focus');
        }
        widgetPreviewLastFocus = null;
    }

    function openWidgetPreviewModal($btn) {
        if (!$widgetPreviewModal.length) {
            return;
        }

        widgetPreviewRequestId += 1;
        var requestId = widgetPreviewRequestId;

        var embedKey = $btn.data('embed-key') || '';
        var layoutLabel = $btn.data('layout-label') || '';
        var widgetName = $btn.data('widget-name') || '';
        var title = widgetName || (i18n.preview || 'Preview');
        if (layoutLabel) {
            title = title + ' — ' + layoutLabel;
        }

        widgetPreviewLastFocus = $btn;
        $widgetPreviewModal.find('[data-grwi-saved-preview-label]').prop('hidden',true).text('');
        $widgetPreviewModal.find('#grwi-widget-preview-modal-title').text(title);
        $widgetPreviewModal.removeAttr('hidden');
        $('body').addClass('grw-modal-open');

        resetWidgetPreviewModalLayers();
        prepareWidgetPreviewModalMount();
        $widgetPreviewMount.attr('hidden', true);
        $widgetPreviewLoading.removeAttr('hidden');

        $widgetPreviewModal.find('.grw-widget-preview-modal__close').trigger('focus');

        mountEmbedPreview($widgetPreviewMount, embedKey, requestId, function (success) {
            if (requestId !== widgetPreviewRequestId) {
                return;
            }
            $widgetPreviewLoading.attr('hidden', true);
            if (success) {
                $widgetPreviewMount.removeAttr('hidden');
                return;
            }
            destroyWidgetPreviewMount($widgetPreviewMount);
            $widgetPreviewMount.removeAttr('hidden').html(
                '<p class="grw-hint">' + (i18n.previewFailed || 'Could not load preview.') + '</p>'
            );
        });
    }

    function showAdminNotice(message, type, upgradeUrl) {
        var $wrap = $('#grwi-admin-notices');
        if (!$wrap.length) {
            return;
        }
        var $notice = $('<div>', {
            'class': 'notice notice-' + (type || 'success') + ' is-dismissible',
            html: '<p></p>'
        });
        var $paragraph = $notice.find('p');
        $paragraph.text(message);
        var href = safeUpgradeUrl(upgradeUrl);
        if (href) {
            $paragraph.append(document.createTextNode(' '));
            $paragraph.append($('<a>', {
                href: href,
                target: '_blank',
                rel: 'noopener noreferrer',
                text: i18n.viewPlans || 'View plans'
            }));
        }
        $wrap.empty().append($notice);
        $('html, body').animate({ scrollTop: $wrap.offset().top - 40 }, 200);
    }

    function updateWidgetCountLabel() {
        var $subtitle = $('#grwi-widgets-count-label');
        if (!$subtitle.length) {
            return;
        }
        var count = $('.grw-widget-row').length;
        var singular = i18n.widgetCountSingular || '%d widget on this site';
        var plural = i18n.widgetCountPlural || '%d widgets on this site';
        var template = count === 1 ? singular : plural;
        $subtitle.text(template.replace('%d', String(count)));
    }

    function closeAllWidgetMenus(except) {
        $('.grw-widget-row__menu-toggle').each(function () {
            if (except && this === except) {
                return;
            }
            $(this).attr('aria-expanded', 'false');
            $(this).closest('.grw-widget-row__menu').find('.grw-widget-row__menu-panel').prop('hidden', true);
        });
    }

    function copyTextToClipboard(text, onCopied) {
        if (!text) {
            return;
        }
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(onCopied).catch(function () {
                fallbackCopy(text, onCopied);
            });
        } else {
            fallbackCopy(text, onCopied);
        }
    }

    function showCopiedShortcodeNotice() {
        var message = i18n.copiedShortcode || 'Shortcode copied to your clipboard.';
        $('#grwi-copy-toast').remove();
        var $toast = $('<div>', {
            id: 'grwi-copy-toast',
            'class': 'grw-copy-toast',
            role: 'status',
            'aria-live': 'polite'
        });
        $toast.append($('<span>', {
            'class': 'dashicons dashicons-yes-alt grw-copy-toast__icon',
            'aria-hidden': 'true'
        }));
        $toast.append($('<p>', { 'class': 'grw-copy-toast__text', text: message }));
        $('body').append($toast);
        window.setTimeout(function () {
            $toast.addClass('is-leaving');
            window.setTimeout(function () {
                $toast.remove();
            }, 180);
        }, 2400);
    }

    function markCopyButtonDone($btn) {
        var label = $btn.attr('aria-label') || '';
        var title = $btn.attr('title') || '';
        var originalText = $btn.is('.grw-widget-row__btn--icon') ? null : $btn.text();
        $btn.addClass('grw-copy-btn--done');
        if ($btn.is('.grw-widget-row__btn--icon') || $btn.is('[data-copy]')) {
            $btn.attr('title', i18n.copied || 'Copied!');
            $btn.attr('aria-label', i18n.copied || 'Copied!');
        } else {
            $btn.text(i18n.copied || 'Copied!');
        }
        window.setTimeout(function () {
            $btn.removeClass('grw-copy-btn--done');
            if (originalText !== null && !$btn.is('.grw-widget-row__btn--icon')) {
                $btn.text(originalText);
            }
            if (title) {
                $btn.attr('title', title);
            }
            if (label) {
                $btn.attr('aria-label', label);
            }
        }, 1600);
    }

    function scrollToCreateWidget() {
        var $create = $('#grwi-create-heading').closest('.grw-panel--create');
        if (!$create.length) {
            $create = $('.grw-panel--create').first();
        }
        if (!$create.length) {
            return;
        }
        var top = $create.offset().top - 40;
        $('html, body').animate({ scrollTop: top }, 220, function () {
            var $search = $('#grwi-place-search');
            if ($search.length) {
                $search.trigger('focus');
            }
        });
    }

    function revealCreatePanel() {
        var $create = $('#grwi-create-panel');
        if (!$create.length) {
            return;
        }
        $create.prop('hidden', false);
        $('#grwi-create-widget-btn').attr('aria-expanded', 'true');
    }

    $(document).on('click', '[data-grwi-layout-filter]', function () {
        var key = $(this).attr('data-grwi-layout-filter') || 'all';
        var $bar = $(this).closest('.grw-layout-filters');
        $bar.find('[data-grwi-layout-filter]').removeClass('is-active').attr('aria-selected', 'false');
        $(this).addClass('is-active').attr('aria-selected', 'true');
        var $root = $(this).closest('#grwi-create-panel');
        $root.find('.grw-layout-category[data-layout-section]').each(function () {
            var section = $(this).attr('data-layout-section') || '';
            $(this).prop('hidden', key !== 'all' && section !== key);
        });
    });

    $('#grwi-create-widget-btn').on('click', function (e) {
        var $btn = $(this);
        if ($btn.prop('disabled')) {
            return;
        }
        if ($btn.is('[data-grwi-connect-account]') || $btn.is('a')) {
            return;
        }
        e.preventDefault();
        revealCreatePanel();
        scrollToCreateWidget();
    });

    $(document).on('click', '[data-grwi-plan-switch]', function () {
        var plan = String($(this).attr('data-grwi-plan-switch') || '');
        var $card = $(this).closest('[data-grwi-plan]');
        if (!plan || !$card.length) {
            return;
        }
        $card.attr('data-grwi-plan', plan);
        $card.find('[data-grwi-plan-switch]').attr('aria-selected', 'false').removeClass('is-active');
        $(this).attr('aria-selected', 'true').addClass('is-active');
        $card.find('[data-grwi-plan-panel]').prop('hidden', true);
        $card.find('[data-grwi-plan-panel="' + plan + '"]').prop('hidden', false);
    });

    $(document).on('click', '[data-grwi-review-ask]', function (e) {
        var choice = String($(this).attr('data-grwi-review-ask') || '');
        if (choice !== 'review') {
            e.preventDefault();
        }
        if (!window.grwiAdmin || choice === '') {
            $('#grwi-review-ask').remove();
            return;
        }
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_review_prompt',
            nonce: grwiAdmin.nonce,
            choice: choice
        });
        $('#grwi-review-ask').remove();
    });

    $('#grwi-create-panel-hide').on('click', function () {
        $('#grwi-create-panel').prop('hidden', true);
        $('#grwi-create-widget-btn').attr('aria-expanded', 'false');
        var $widgets = $('#grwi-widgets-heading');
        if ($widgets.length) {
            var top = $widgets.offset().top - 40;
            $('html, body').animate({ scrollTop: Math.max(0, top) }, 180);
        }
    });

    $('#grwi-widget-search').on('input', function () {
        var q = String($(this).val() || '').trim().toLowerCase();
        var visible = 0;
        $('.grw-widget-row').each(function () {
            var hay = String($(this).attr('data-search') || '').toLowerCase();
            var match = !q || hay.indexOf(q) !== -1;
            $(this).prop('hidden', !match);
            if (match) {
                visible += 1;
            }
        });
        $('#grwi-widget-search-empty').prop('hidden', visible > 0);
    });

    $(document).on('click', '.grw-widget-row__menu-toggle', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $btn = $(this);
        var open = $btn.attr('aria-expanded') === 'true';
        closeAllWidgetMenus(open ? null : this);
        $btn.attr('aria-expanded', open ? 'false' : 'true');
        $btn.closest('.grw-widget-row__menu').find('.grw-widget-row__menu-panel').prop('hidden', open);
    });

    $(document).on('click', function () {
        closeAllWidgetMenus();
    });

    $(document).on('keydown', function (e) {
        if (e.key === 'Escape') {
            closeAllWidgetMenus();
            closeDeleteWidgetModal();
        }
    });

    $(document).on('click', '.grw-widget-row__copy-shortcode, .grw-widget-row__menu-item[data-copy]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $btn = $(this);
        var text = $btn.data('copy') || '';
        copyTextToClipboard(text, function () {
            markCopyButtonDone($btn.is('.grw-widget-row__menu-item')
                ? $btn.closest('.grw-widget-row').find('.grw-widget-row__copy-shortcode')
                : $btn);
            showCopiedShortcodeNotice();
            closeAllWidgetMenus();
        });
    });

    var $deleteModal = $('#grwi-delete-widget-modal');
    var deleteModalState = null;
    var deleteModalLastFocus = null;

    function closeDeleteWidgetModal() {
        if (!$deleteModal.length) {
            return;
        }
        $deleteModal.attr('hidden', true);
        $('body').removeClass('grw-modal-open');
        deleteModalState = null;
        if (deleteModalLastFocus && deleteModalLastFocus.focus) {
            try { deleteModalLastFocus.focus(); } catch (err) { /* ignore */ }
        }
        deleteModalLastFocus = null;
    }

    function openDeleteWidgetModal(embedKey, widgetName) {
        if (!$deleteModal.length || !embedKey) {
            return;
        }
        deleteModalState = { embedKey: embedKey, widgetName: widgetName || '' };
        deleteModalLastFocus = document.activeElement;
        var template = i18n.deleteConfirmNamed
            || 'Delete “%s”? This will remove the widget from pages where its shortcode or block is used.';
        $('#grwi-delete-widget-body').text(template.replace('%s', widgetName || (i18n.thisWidget || 'this widget')));
        $deleteModal.removeAttr('hidden');
        $('body').addClass('grw-modal-open');
        $('#grwi-delete-widget-confirm').prop('disabled', false).trigger('focus');
    }

    function performDeleteWidget(embedKey, $busyBtn) {
        if (!embedKey) {
            return;
        }
        if ($busyBtn && $busyBtn.length) {
            $busyBtn.prop('disabled', true);
        }
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_delete_widget',
            nonce: grwiAdmin.nonce,
            embed_key: embedKey
        }).done(function (response) {
            if (!response || !response.success) {
                var errMsg = (response && response.data && response.data.message)
                    ? response.data.message
                    : (i18n.deleteFailed || 'Could not delete widget.');
                showAdminNotice(errMsg, 'error');
                if ($busyBtn && $busyBtn.length) {
                    $busyBtn.prop('disabled', false);
                }
                return;
            }
            closeDeleteWidgetModal();
            var $row = $('.grw-widget-row[data-embed-key="' + embedKey + '"]');
            $row.remove();
            updateWidgetCountLabel();
            if ($('.grw-widget-row').length === 0) {
                window.location.reload();
                return;
            }
            showAdminNotice(i18n.deleted || 'Widget deleted.', 'success');
        }).fail(function (xhr) {
            var errMsg = i18n.deleteFailed || 'Could not delete widget.';
            if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                    errMsg = xhr.responseJSON.data.message;
                }
            showAdminNotice(errMsg, 'error');
            if ($busyBtn && $busyBtn.length) {
                $busyBtn.prop('disabled', false);
            }
        });
    }

    $(document).on('click', '[data-grw-delete-widget]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $btn = $(this);
        closeAllWidgetMenus();
        openDeleteWidgetModal($btn.data('embed-key') || '', $btn.data('widget-name') || '');
    });

    $(document).on('click', '[data-grw-delete-close]', function (e) {
        e.preventDefault();
        closeDeleteWidgetModal();
    });

    $('#grwi-delete-widget-confirm').on('click', function (e) {
        e.preventDefault();
        if (!deleteModalState || !deleteModalState.embedKey) {
            return;
        }
        performDeleteWidget(deleteModalState.embedKey, $(this));
    });

    $(document).on('click', '[data-grw-duplicate-widget]', function (e) {
        e.preventDefault();
        e.stopPropagation();
        var $btn = $(this);
        var embedKey = $btn.data('embed-key') || '';
        if (!embedKey) {
            return;
        }
        closeAllWidgetMenus();
        $btn.prop('disabled', true);
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_duplicate_widget',
            nonce: grwiAdmin.nonce,
            embed_key: embedKey
        }).done(function (response) {
            $btn.prop('disabled', false);
            if (!response || !response.success) {
                var errMsg = (response && response.data && response.data.message)
                    ? response.data.message
                    : (i18n.duplicateFailed || 'Could not duplicate widget.');
                showAdminNotice(errMsg, 'error');
                return;
            }
            var customizeUrl = response.data && response.data.customize_url
                ? response.data.customize_url
                : '';
            if (customizeUrl) {
                window.location.href = customizeUrl;
                return;
            }
            window.location.reload();
        }).fail(function (xhr) {
            $btn.prop('disabled', false);
            var errMsg = i18n.duplicateFailed || 'Could not duplicate widget.';
            if (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message) {
                errMsg = xhr.responseJSON.data.message;
            }
            showAdminNotice(errMsg, 'error');
        });
    });

    // Widget list preview modal
    $(document).on('click', '.grw-widget-preview-toggle', function (e) {
        e.preventDefault();
        openWidgetPreviewModal($(this));
    });

    $(document).on('click', '[data-grw-preview-close]', function () {
        closeWidgetPreviewModal();
    });

    $(document).on('keydown.grwiPreviewModal', function (e) {
        if (e.key === 'Escape' && $widgetPreviewModal.length && !$widgetPreviewModal.is('[hidden]')) {
            closeWidgetPreviewModal();
        }
    });

    // Copy shortcode buttons (create-result / legacy)
    $('.grw-copy-btn').on('click', function () {
        var $btn = $(this);
        var text = $btn.data('copy') || $btn.siblings('.grw-shortcode-input').val() || '';
        if (!text) {
            return;
        }
        copyTextToClipboard(text, function () {
            var original = $btn.text();
            $btn.addClass('grw-copy-btn--done').text(i18n.copied || 'Copied!');
            showCopiedShortcodeNotice();
            setTimeout(function () {
                $btn.removeClass('grw-copy-btn--done').text(original);
            }, 1600);
        });
    });

    function fallbackCopy(text, callback) {
        var $temp = $('<textarea>').val(text).css({ position: 'fixed', left: '-9999px' }).appendTo('body');
        $temp[0].select();
        try {
            document.execCommand('copy');
            callback();
        } catch (err) {
            // ignore
        }
        $temp.remove();
    }

    $(document).on('click', function (e) {
        if (!$(e.target).closest('.grw-field--place-search').length) {
            hideResults();
        }
    });

    function layoutCardPresentationFor(layout) {
        var key = String(layout || '');
        if (key === 'feed_masonry') {
            return {
                preview_variant: 'examples-masonry',
                masonry_show_all: true
            };
        }
        if (key === 'feed_slider') {
            return {
                showcase_rows: 1
            };
        }
        if (key === 'feed_grid') {
            return {
                preview_variant: 'examples',
                showcase_rows: 2,
                demo_photos: 'selective',
                max_reviews: 8
            };
        }
        if (key === 'feed_list') {
            return {
                max_reviews: 3
            };
        }
        return null;
    }

    function layoutCardThumbnailReviews(layout, feedReviewCount) {
        var key = String(layout || '');
        switch (key) {
            case 'feed_list': return Math.min(feedReviewCount, 2);
            case 'feed_grid': return 8;
            case 'feed_slider': return 8;
            case 'feed_carousel': return Math.min(feedReviewCount, 4);
            default: return feedReviewCount;
        }
    }

    function layoutCardFeedFitScale(layout) {
        switch (String(layout || '')) {
            case 'feed_grid': return 0.88;
            case 'feed_list': return 0.76;
            case 'feed_slider': return 0.74;
            case 'feed_carousel': return 0.88;
            case 'feed_masonry': return 0.88;
            default: return 0.88;
        }
    }

    function layoutCardRecipeFor(layout) {
        var key = String(layout || '');
        var configs = (previewDemo && previewDemo.configs) ? previewDemo.configs : {};
        var reviews = layoutPickerStyleReviews();
        var feedReviewCount = reviews.length > 0 ? reviews.length : 6;
        var cfg = configs[key] || {};
        var cfgCount = parseInt(cfg.feed_initial_review_count, 10);
        if (isFinite(cfgCount) && cfgCount > 0) {
            feedReviewCount = cfgCount;
        }

        if (key.indexOf('feed_') === 0) {
            feedReviewCount = layoutCardThumbnailReviews(key, feedReviewCount);
            // Stage widths are the border box. The query container's content box is
            // about 44px narrower (shell padding), and masonry packs from the inner
            // columns element (~80px narrower). Stay above the 880px 2-column breakpoint.
            // Carousel feed (feed_slider) cards are about 272px wide, so the stage
            // has to leave room for four of them plus the arrow inset.
            switch (key) {
                case 'feed_list': return { mode: 'feed', width: 540, reviews: feedReviewCount };
                case 'feed_grid': return { mode: 'feed', width: 960, reviews: feedReviewCount };
                case 'feed_masonry': return { mode: 'feed', width: 1000, reviews: feedReviewCount };
                case 'feed_carousel': return { mode: 'feed', width: 560, reviews: feedReviewCount };
                case 'feed_slider': return { mode: 'feed', width: 1400, reviews: feedReviewCount };
                case 'feed_review_ribbon': return { mode: 'feed', width: 880, reviews: feedReviewCount };
                case 'feed_mini_slider': return { mode: 'feed', width: 740, reviews: feedReviewCount };
                case 'feed_reputation_snapshot': return { mode: 'feed', width: 590, reviews: 4 };
                case 'feed_review_mosaic': return { mode: 'feed', width: 960, reviews: 6 };
                case 'feed_photo_spotlight': return { mode: 'feed', width: 940, reviews: 3 };
                case 'feed_classic_carousel': return { mode: 'feed', width: 960, reviews: feedReviewCount };
                case 'feed_classic_slider': return { mode: 'feed', width: 740, reviews: 6 };
                case 'feed_classic_list': return { mode: 'feed', width: 740, reviews: 3 };
                case 'feed_classic_grid': return { mode: 'feed', width: 1090, reviews: 6 };
                case 'feed_classic_masonry': return { mode: 'feed', width: 1090, reviews: 6 };
                default: return { mode: 'feed', width: 540, reviews: feedReviewCount };
            }
        }

        switch (key) {
            case 'sticker_light': return { mode: 'container', width: 200 };
            case 'sticker_bold': return { mode: 'container', width: 200 };
            case 'sticker_tag': return { mode: 'container', width: 220 };
            case 'sticker_pill': return { mode: 'container', width: 280 };
            case 'sticker_ribbon': return { mode: 'container', width: 380 };
            case 'badge_card': return { mode: 'intrinsic', width: 300 };
            case 'badge_compact': return { mode: 'intrinsic', width: 340 };
            case 'badge_inline': return { mode: 'intrinsic', width: 460 };
            case 'badge_avatar': return { mode: 'intrinsic', width: 380, reviews: 8 };
            case 'badge_inline_reviews': return { mode: 'intrinsic', width: 420 };
            case 'badge_essential': return { mode: 'intrinsic', width: 320 };
            case 'badge_text_rating': return { mode: 'intrinsic', width: 360 };
            case 'badge_stacked': return { mode: 'intrinsic', width: 280 };
            case 'badge_micro_strip': return { mode: 'intrinsic', width: 520 };
            case 'badge_review_request': return { mode: 'container', width: 480, reviews: 4 };
            default: return { mode: 'intrinsic' };
        }
    }

    function layoutCardVisualRoot(target) {
        return target.querySelector('.grw-sticker-shape')
            || target.querySelector('.grw-pill-chip')
            || target.querySelector('.lf-request')
            || target.querySelector('.og-ribbon')
            || target.querySelector('.grw-mini-slider')
            || target.querySelector('.grw-rs-widget')
            || target.querySelector('.grw-mosaic')
            || target.querySelector('.og-story')
            || target.querySelector('.grw-preview-classic-carousel')
            || target.querySelector('.lf-feed')
            || target.querySelector('.grw-avatar-proof')
            || target.querySelector('.grw-badge')
            || target.querySelector('.grw-mock')
            || target.firstElementChild
            || target;
    }

    function layoutCardMeasureBox(mock) {
        var boxW = mock.clientWidth;
        var boxH = mock.clientHeight;
        if (boxW && boxH) {
            return { boxW: boxW, boxH: boxH };
        }
        var preview = mock.closest('.grw-layout-card__preview');
        if (preview) {
            boxW = boxW || preview.clientWidth;
            boxH = boxH || preview.clientHeight;
        }
        return { boxW: boxW, boxH: boxH };
    }

    function layoutCardFit(mock) {
        var stage = mock.querySelector('[data-grw-layout-stage]');
        var target = mock.querySelector('[data-grw-layout-target]');
        if (!stage || !target) {
            return;
        }
        var recipe = mock.__grwLayoutRecipe || { mode: 'intrinsic' };

        stage.style.transform = 'none';
        var measured = layoutCardMeasureBox(mock);
        var boxW = measured.boxW;
        var boxH = measured.boxH;
        if (!boxW || !boxH) {
            return;
        }

        if (recipe.mode === 'feed') {
            var natW = stage.offsetWidth;
            var natH = stage.scrollHeight || stage.offsetHeight;
            if (!natW || !natH) {
                return;
            }
            var layoutKey = mock.getAttribute('data-layout') || '';
            var fitPad = layoutCardFeedFitScale(layoutKey);
            var widthScale = (boxW * fitPad) / natW;
            var heightScale = (boxH * 0.94) / natH;
            var scale = Math.min(widthScale, heightScale);
            if (!isFinite(scale) || scale <= 0) {
                scale = 0.1;
            }
            scale = Math.min(scale, 1);
            // Pixel centering — mock can report 0 width (WP admin / span defaults), so left:50% misses the card.
            var scaledW = natW * scale;
            var scaledH = natH * scale;
            var tx = (boxW - scaledW) / 2;
            var ty = natH * scale <= boxH ? (boxH - scaledH) / 2 : 0;
            stage.style.left = '0px';
            stage.style.top = '0px';
            stage.style.transformOrigin = '0 0';
            stage.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + scale + ')';
            return;
        }

        var widget = layoutCardVisualRoot(target);
        var stageRect = stage.getBoundingClientRect();
        var wRect = widget.getBoundingClientRect();
        var natW2 = wRect.width;
        var natH2 = wRect.height;
        if (!natW2 || !natH2) {
            return;
        }
        var s = Math.min((boxW * 0.94) / natW2, (boxH * 0.9) / natH2);
        if (!isFinite(s) || s <= 0) {
            s = 0.1;
        }
        s = Math.min(s, 1);
        var wx = wRect.left - stageRect.left;
        var wy = wRect.top - stageRect.top;
        stage.style.left = '0px';
        stage.style.top = '0px';
        stage.style.transformOrigin = '0 0';
        var tx = (boxW / 2) - s * (wx + natW2 / 2);
        var ty = (boxH / 2) - s * (wy + natH2 / 2);
        stage.style.transform = 'translate(' + tx + 'px, ' + ty + 'px) scale(' + s + ')';
    }

    function mountSavedDashboardThumbnail(mockEl) {
        if (mockEl.getAttribute('data-grw-preview-mounted') === 'loading') return false;
        var row = mockEl.closest('.grw-widget-row');
        var key = row && row.getAttribute('data-embed-key');
        var target = mockEl.querySelector('[data-grw-layout-target]');
        var stage = mockEl.querySelector('[data-grw-layout-stage]');
        if (!key || !target || !stage) return false;
        var request = (mockEl.__savedPreviewRequest || 0) + 1; mockEl.__savedPreviewRequest=request;
        mockEl.setAttribute('data-grw-preview-mounted','loading');
        loadSavedDashboardPreview(key).then(function(data){
            if (mockEl.__savedPreviewRequest !== request || !mockEl.isConnected) return;
            var layout=data.layout || mockEl.getAttribute('data-layout');
            mockEl.setAttribute('data-layout',layout);
            mockEl.__grwLayoutRecipe=layoutCardRecipeFor(layout);
            var recipe=mockEl.__grwLayoutRecipe;
            stage.style.width=recipe.width ? recipe.width+'px' : 'max-content';
            target.setAttribute('data-preview-wrapper-class','grw-layout-card__target');
            destroyWidgetPreviewMount($(target));
            if (!mountSavedWidgetPreviewFromPayload(target,data)) throw new Error('Preview mount failed');
            mockEl.setAttribute('data-grw-preview-mounted','1');
            var label=row.querySelector('[data-grwi-saved-preview-label]');
            if (!label) {label=document.createElement('small');label.setAttribute('data-grwi-saved-preview-label','');label.className='grw-widget-row__preview-state';(row.querySelector('.grw-widget-row__identity') || row).appendChild(label);}
            label.textContent=savedPreviewLabel(data);label.hidden=data.preview_state !== 'draft';
            if (data.layout_label) {$(row).find('.grw-widget-row__layout').text(data.layout_label);$(row).find('.grw-widget-preview-toggle').attr('data-layout-label',data.layout_label).data('layout-label',data.layout_label);}
            layoutCardFit(mockEl);requestAnimationFrame(function(){layoutCardFit(mockEl);});
            target.querySelectorAll('img').forEach(function(img){if(!img.complete)img.addEventListener('load',function(){layoutCardFit(mockEl);},{once:true});});
        }).catch(function(){if(mockEl.__savedPreviewRequest===request){mockEl.setAttribute('data-grw-preview-mounted','error');target.textContent='Saved preview unavailable';}});
        return true;
    }

    function layoutCardMountMock(mockEl) {
        if (!mockEl || mockEl.getAttribute('data-grw-preview-mounted') === '1') {
            return false;
        }

        if (mockEl.closest('.grw-widget-row[data-embed-key]')) return mountSavedDashboardThumbnail(mockEl);

        var layout = mockEl.getAttribute('data-layout') || 'badge_card';
        var theme = mockEl.getAttribute('data-preview-theme') || previewTheme;
        var stage = mockEl.querySelector('[data-grw-layout-stage]');
        var target = mockEl.querySelector('[data-grw-layout-target]');
        if (!stage || !target) {
            return false;
        }

        var recipe = layoutCardRecipeFor(layout);
        mockEl.__grwLayoutRecipe = recipe;

        // GrwPreview.mount replaces className — keep the target class so admin.css display:block survives.
        target.setAttribute('data-preview-wrapper-class', 'grw-layout-card__target');

        if (recipe.mode === 'feed' || recipe.mode === 'container') {
            stage.style.width = recipe.width + 'px';
        } else {
            stage.style.width = recipe.width ? (recipe.width + 'px') : 'max-content';
            stage.style.minWidth = recipe.width ? (recipe.width + 'px') : '';
        }

        var reviewCount = recipe.reviews || 0;
        var reviews = (previewDemo && Array.isArray(previewDemo.reviews) && previewDemo.reviews.length)
            ? previewDemo.reviews
            : layoutPickerStyleReviews();
        var mountReviews = reviewCount > 0 ? reviews.slice(0, reviewCount) : reviews.slice(0, 1);
        var extraConfig = { theme: theme, reviews: mountReviews };
        /* Dashboard thumbs: Compact Badge keeps the Google tracer (marketing gallery),
           not the solid #1a73e8 ring that reads as FREE WITH ACCOUNT lock chrome. */
        if (layout === 'badge_compact') {
            extraConfig.widget_border_style = 'google_tracer';
            extraConfig.widget_border_width = '3px';
        }
        var presentation = layoutCardPresentationFor(layout);
        if (presentation) {
            extraConfig.presentation = presentation;
        }
        if (reviewCount > 0) {
            extraConfig.maxReviews = reviewCount;
        }
        if (layout === 'feed_grid' || layout === 'feed_masonry' || layout === 'feed_slider') {
            extraConfig.feed_columns = 4;
        }
        if (recipe.mode === 'feed') {
            extraConfig.filledClass = 'w-full min-w-0 text-left';
        } else if (layout === 'badge_review_request') {
            extraConfig.filledClass = 'w-full min-w-0';
        } else if (recipe.mode === 'container') {
            extraConfig.filledClass = 'w-full min-w-0 flex items-center justify-center';
        } else {
            extraConfig.filledClass = 'w-max max-w-full inline-block';
        }

        var ok = mountLayoutPickerStylePreview(target, {}, layout, extraConfig);
        if (!ok) {
            return false;
        }

        mockEl.setAttribute('data-grw-preview-mounted', '1');
        layoutCardFit(mockEl);
        requestAnimationFrame(function () {
            layoutCardFit(mockEl);
        });
        target.querySelectorAll('img').forEach(function (img) {
            if (img.complete) {
                return;
            }
            img.addEventListener('load', function () { layoutCardFit(mockEl); }, { once: true });
            img.addEventListener('error', function () { layoutCardFit(mockEl); }, { once: true });
        });
        return true;
    }

    function initLayoutCardMockPreviews() {
        var $mocks = $('.grw-layout-card__mock[data-layout]').filter(function () {
            return this.getAttribute('data-grw-preview-mounted') !== '1';
        });
        if (!$mocks.length) {
            return;
        }

        function renderWhenReady(mockEl) {
            grwiWhenPreviewReady(function () {
                layoutCardMountMock(mockEl);
            });
        }

        $mocks.each(function (index) {
            if (index < 3) {
                renderWhenReady(this);
            }
        });

        if (typeof window.IntersectionObserver !== 'function') {
            $mocks.each(function () {
                renderWhenReady(this);
            });
            return;
        }

        var observer = new window.IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                renderWhenReady(entry.target);
                observer.unobserve(entry.target);
            });
        }, { root: null, rootMargin: '240px 0px', threshold: 0.01 });

        $mocks.each(function (index) {
            if (index < 3 || this.getAttribute('data-grw-preview-mounted') === '1') {
                return;
            }
            observer.observe(this);
        });

        if (!window.__grwiLayoutCardFitBound) {
            window.__grwiLayoutCardFitBound = true;
            var resizeTimer = null;
            function refitLayoutCards() {
                document.querySelectorAll('.grw-layout-card__mock[data-grw-preview-mounted="1"]').forEach(function (mock) {
                    layoutCardFit(mock);
                });
            }
            window.addEventListener('load', refitLayoutCards);
            window.addEventListener('resize', function () {
                clearTimeout(resizeTimer);
                resizeTimer = setTimeout(refitLayoutCards, 120);
            }, { passive: true });
            if (typeof window.ResizeObserver === 'function') {
                var ro = new window.ResizeObserver(function () {
                    clearTimeout(resizeTimer);
                    resizeTimer = setTimeout(refitLayoutCards, 120);
                });
                document.querySelectorAll('.grw-layout-card__mock[data-layout]').forEach(function (mock) {
                    ro.observe(mock);
                });
            }
        }
    }

    window.addEventListener('pageshow', function(event){
        if (!event.persisted) return;
        savedDashboardPreviews=Object.create(null);
        document.querySelectorAll('.grw-widget-row__mock').forEach(function(mock){mock.__savedPreviewRequest=(mock.__savedPreviewRequest||0)+1;mock.removeAttribute('data-grw-preview-mounted');});
        initLayoutCardMockPreviews();
    });

    initLayoutCardMockPreviews();

    function mountCreateResultPreview() {
        var $panel = $('#grwi-create-result-preview-mount');
        if (!$panel.length) {
            return;
        }
        var params = new URLSearchParams(window.location.search);
        var embedKey = params.get('grwi_widget') || '';
        if (!embedKey) {
            return;
        }
        var apiBase = (window.grwiAdmin && grwiAdmin.apiBaseUrl) ? grwiAdmin.apiBaseUrl.replace(/\/$/, '') : '';
        if (!apiBase) {
            return;
        }
        function renderFromPayload(data) {
            if (!data) {
                return;
            }
            prepareSavedWidgetPreviewMount($panel[0], 'grw-live-preview__target');
            mountSavedWidgetPreviewFromPayload($panel[0], data);
        }
        var run = function () {
            fetch(apiBase + '/widgets/' + encodeURIComponent(embedKey) + '.json', { credentials: 'omit' })
                .then(function (response) { return response.ok ? response.json() : null; })
                .then(renderFromPayload)
                .catch(function () { /* ignore */ });
        };
        if (!grwiWhenPreviewReady(run)) {
            run();
        }
    }

    mountCreateResultPreview();

    function setConnectStatus(message) {
        var $status = $('[data-grwi-connect-status]');
        if ($status.length) {
            $status.text(message || (i18n.connectHint || ''));
        }
    }

    function resetConnectUi($btn, message) {
        if (activeConnectPollTimer) {
            clearInterval(activeConnectPollTimer);
            activeConnectPollTimer = null;
        }
        if (activeConnectCloseWatcher) {
            clearInterval(activeConnectCloseWatcher);
            activeConnectCloseWatcher = null;
        }
        if ($btn && $btn.length) {
            $btn.prop('disabled', false);
        }
        $('[data-grwi-connect-account]').prop('disabled', false);
        setConnectStatus(message || i18n.connectHint || '');
        $(window).off('message.grwiConnect');
    }

    function finishConnect(connectToken, $btn) {
        setConnectStatus(i18n.connectClaiming || 'Finishing connection…');
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_connect_claim',
            nonce: grwiAdmin.nonce,
            connect_token: connectToken
        }).done(function (resp) {
            if (!resp || !resp.success) {
                var msg = (resp && resp.data && resp.data.message) ? resp.data.message : (i18n.connectFailed || 'Could not finish connect.');
                resetConnectUi($btn, msg);
                return;
            }
            setConnectStatus(i18n.connectSuccess || 'Connected! Reloading…');
            var reloadUrl = (resp.data && resp.data.reload_url) ? resp.data.reload_url : window.location.href;
            window.location.href = reloadUrl;
        }).fail(function (xhr) {
            var msg = (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message)
                ? xhr.responseJSON.data.message
                : (i18n.connectFailed || 'Could not finish connect.');
            resetConnectUi($btn, msg);
        });
    }

    function pollConnectStatus(connectToken, $btn, popup) {
        var attempts = 0;
        var maxAttempts = 90;
        var closedGraceAttempts = 0;
        var maxClosedGrace = 3; // ~6s after popup close for late claim
        var reenabledAfterClose = false;
        var timer = setInterval(function () {
            attempts += 1;

            if (popup && popup.closed) {
                if (!reenabledAfterClose) {
                    reenabledAfterClose = true;
                    // Let the user retry immediately; keep polling briefly for a late claim.
                if ($btn && $btn.length) {
                    $btn.prop('disabled', false);
                }
                    $('[data-grwi-connect-account]').prop('disabled', false);
                    setConnectStatus(i18n.connectHint || '');
                }
                closedGraceAttempts += 1;
                if (closedGraceAttempts > maxClosedGrace) {
                    clearInterval(timer);
                    if (activeConnectPollTimer === timer) {
                        activeConnectPollTimer = null;
                    }
                    $(window).off('message.grwiConnect');
                return;
            }
            }

            if (attempts > maxAttempts) {
                clearInterval(timer);
                resetConnectUi($btn, i18n.connectFailed || 'Could not finish connect.');
                return;
            }

            $.post(grwiAdmin.ajaxUrl, {
                action: 'grwi_connect_status',
                nonce: grwiAdmin.nonce,
                connect_token: connectToken
            }).done(function (resp) {
                if (!resp || !resp.success || !resp.data) {
                    return;
                }
                if (resp.data.linked || resp.data.status === 'completed' || resp.data.status === 'claimed') {
                    clearInterval(timer);
                    if (activeConnectPollTimer === timer) {
                        activeConnectPollTimer = null;
                    }
                    $(window).off('message.grwiConnect');
                    finishConnect(connectToken, $btn);
                }
            });
        }, 2000);

        return timer;
    }

    $(document).on('click', '[data-grwi-connect-account]', function (e) {
        e.preventDefault();
        if (!window.grwiAdmin || grwiAdmin.isLinked) {
            return;
        }
        var $btn = $(this);
        if ($btn.prop('disabled')) {
            return;
        }
        $btn.prop('disabled', true);
        setConnectStatus(i18n.connectOpening || 'Opening GRWidget.com…');

        // Open during the user's click, before AJAX can consume popup permission.
        var width = 480;
        var height = 720;
        var left = Math.max(0, (window.screen.width - width) / 2);
        var top = Math.max(0, (window.screen.height - height) / 2);
        var popup = window.open(
            'about:blank',
            'grwiConnect',
            'popup=yes,width=' + width + ',height=' + height + ',left=' + left + ',top=' + top + ',noopener=no'
        );
        if (!popup) {
            resetConnectUi($btn, i18n.connectPopupBlocked || 'Pop-up blocked. Allow pop-ups for this site and try again.');
            return;
        }

        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_connect_start',
            nonce: grwiAdmin.nonce,
            opener_origin: window.location.origin
        }).done(function (resp) {
            if (!resp || !resp.success || !resp.data || !resp.data.connect_url) {
                popup.close();
                var failMsg = (resp && resp.data && resp.data.message) ? resp.data.message : (i18n.connectFailed || 'Could not start account connect.');
                resetConnectUi($btn, failMsg);
                return;
            }

            var connectToken = resp.data.connect_token;
            var connectUrl = resp.data.connect_url;
            if (popup.closed) {
                resetConnectUi($btn, i18n.connectHint || '');
                return;
            }
            popup.location.replace(connectUrl);

            setConnectStatus(i18n.connectWaiting || 'Waiting for you to finish in the popup…');
            if (activeConnectPollTimer) {
                clearInterval(activeConnectPollTimer);
            }
            if (activeConnectCloseWatcher) {
                clearInterval(activeConnectCloseWatcher);
            }
            activeConnectPollTimer = pollConnectStatus(connectToken, $btn, popup);
            var finishing = false;
            activeConnectCloseWatcher = setInterval(function () {
                if (!popup || !popup.closed) {
                    return;
                }
                clearInterval(activeConnectCloseWatcher);
                activeConnectCloseWatcher = null;
                if (finishing) {
                    return;
                }
                // Re-enable immediately so Site / Free-with-account clicks can reopen connect.
                if ($btn && $btn.length) {
                    $btn.prop('disabled', false);
                }
                $('[data-grwi-connect-account]').prop('disabled', false);
                setConnectStatus(i18n.connectHint || '');
            }, 400);

            $(window).off('message.grwiConnect').on('message.grwiConnect', function (event) {
                var data = event.originalEvent && event.originalEvent.data ? event.originalEvent.data : null;
                if (!data || data.type !== 'grwi-connected') {
                    return;
                }
                if (data.connect_token && data.connect_token !== connectToken) {
                    return;
                }
                if (finishing) {
                    return;
                }
                finishing = true;
                if (activeConnectCloseWatcher) {
                    clearInterval(activeConnectCloseWatcher);
                    activeConnectCloseWatcher = null;
                }
                if (activeConnectPollTimer) {
                    clearInterval(activeConnectPollTimer);
                    activeConnectPollTimer = null;
                }
                $(window).off('message.grwiConnect');
                finishConnect(connectToken, $btn);
            });
        }).fail(function (xhr) {
            popup.close();
            var msg = (xhr.responseJSON && xhr.responseJSON.data && xhr.responseJSON.data.message)
                ? xhr.responseJSON.data.message
                : (i18n.connectFailed || 'Could not start account connect.');
            resetConnectUi($btn, msg);
        });
    });

    $(document).on('click', '[data-grwi-manage-connection]', function (e) {
        e.preventDefault();
        var $btn = $(this);
        var $panel = $('#grwi-manage-connection');
        if (!$panel.length) {
            return;
        }
        var open = $panel.prop('hidden');
        $panel.prop('hidden', !open);
        $btn.attr('aria-expanded', open ? 'true' : 'false');
    });

    /**
     * Linked accounts: fetch the widget list once per admin page load so widgets
     * created on GRWidget.com appear without a manual Refresh click.
     */
    function refreshLinkedWidgetListOnce() {
        if (window.grwiLinkedWidgetsRefreshStarted) {
            return;
        }
        window.grwiLinkedWidgetsRefreshStarted = true;
        if (!window.grwiAdmin || !grwiAdmin.isLinked || !grwiAdmin.ajaxUrl) {
            return;
        }
        var $wrap = $('.grw-admin').first();
        if (!$wrap.length) {
            return;
        }
        if (/[?&]grwi_sync=1(?:&|$)/.test(window.location.search || '')) {
            return;
        }
        $.post(grwiAdmin.ajaxUrl, {
            action: 'grwi_refresh_widgets',
            nonce: grwiAdmin.nonce
        }).done(function (resp) {
            if (!resp || !resp.success || !resp.data) {
                return;
            }
            var remote = (resp.data.embed_keys || []).slice().map(String).filter(Boolean).sort().join(',');
            var local = String($wrap.attr('data-embed-keys') || '').split(',').filter(Boolean).sort().join(',');
            if (remote === local) {
                return;
            }
            var url;
            try {
                url = new URL(window.location.href);
                url.searchParams.set('grwi_sync', '1');
                window.location.replace(url.toString());
            } catch (err) {
                window.location.reload();
            }
        });
    }

    $(refreshLinkedWidgetListOnce);
})(jQuery);

