<?php

defined('ABSPATH') || exit;

/**
 * Native wp-admin widget style editor (no iframes or external tabs).
 */
class GRWI_Customize
{
    public static function register(): void
    {
        if (! is_admin()) {
            return;
        }

        add_action('admin_menu', [self::class, 'menu']);
        add_action('admin_enqueue_scripts', [self::class, 'assets']);
        add_action('wp_ajax_grwi_get_widget_preview', [self::class, 'ajax_preview_data']);
        add_action('wp_ajax_grwi_save_widget', [self::class, 'ajax_save_widget']);
        add_action('wp_ajax_grwi_report_bug', [self::class, 'ajax_report_bug']);
    }

    /**
     * Default builder tab when the URL has no valid tab= (first open / post-create).
     * Explicit tab=install, tab=customize, tab=ai-summary, etc. are honored by resolve_active_section().
     *
     * @param array<int, string> $section_ids
     */
    public static function default_section_id(array $section_ids = []): string
    {
        if ($section_ids === [] || in_array('style', $section_ids, true)) {
            return 'style';
        }

        return sanitize_key((string) ($section_ids[0] ?? 'style')) ?: 'style';
    }

    /**
     * @param array<int, string> $section_ids
     */
    public static function resolve_active_section(string $requested_tab, array $section_ids): string
    {
        $requested_tab = sanitize_key($requested_tab);
        if ($requested_tab === 'options'
            && ! in_array('options', $section_ids, true)
            && in_array('settings', $section_ids, true)
        ) {
            $requested_tab = 'settings';
        }
        if ($requested_tab !== '' && in_array($requested_tab, $section_ids, true)) {
            return $requested_tab;
        }

        return self::default_section_id($section_ids);
    }

    /**
     * @param string $tab Optional builder section id (e.g. install, customize, style).
     */
    public static function page_url(string $embed_key, string $tab = ''): string
    {
        $args = [
            'page' => 'grwi-customize',
            'widget' => sanitize_text_field($embed_key),
        ];
        $tab = sanitize_key($tab);
        if ($tab !== '') {
            $args['tab'] = $tab;
        }

        return add_query_arg($args, admin_url('admin.php'));
    }

    public static function menu(): void
    {
        add_submenu_page(
            null,
            __('Customize widget', 'gr-widget'),
            __('Customize widget', 'gr-widget'),
            'manage_options',
            'grwi-customize',
            [self::class, 'render_page']
        );
    }

    public static function assets(string $hook): void
    {
        if ($hook !== 'admin_page_grwi-customize') {
            return;
        }

        wp_enqueue_style('grwi-admin', GRWI_PLUGIN_URL . 'assets/admin.css', [], self::asset_version('assets/admin.css'));
        $customize_css_ver = self::asset_version('assets/admin-customize.css');
        wp_enqueue_style('grwi-customize', GRWI_PLUGIN_URL . 'assets/admin-customize.css', ['grwi-admin'], $customize_css_ver);

        $client = new GRWI_API_Client();
        if (! $client->is_registered() && ! $client->is_linked()) {
            return;
        }
        add_filter('wp_resource_hints', [GRWI_Admin::class, 'resource_hints'], 10, 2);
        $caps = $client->capabilities();
        $preview_script = esc_url((string) ($caps['preview_script_url'] ?? 'https://grwidget.com/js/grw-preview.js'));
        wp_enqueue_script('grwi-preview', $preview_script, [], GRWI_VERSION, true);
        $mock_css = esc_url((string) ($caps['mock_css_url'] ?? ''));
        if ($mock_css !== '') {
            wp_enqueue_style('grwi-widget-mock', $mock_css, [], GRWI_VERSION);
        }
        $deps = ['jquery', 'grwi-preview', 'grwi-customize-builder'];
        wp_enqueue_script('grwi-preview-opts', GRWI_PLUGIN_URL . 'assets/admin-preview-opts.js', ['jquery'], GRWI_VERSION, true);
        $builder_ver = self::asset_version('assets/admin-customize-builder.js');
        $customize_ver = self::asset_version('assets/admin-customize.js');
        wp_enqueue_script('grwi-customize-builder', GRWI_PLUGIN_URL . 'assets/admin-customize-builder.js', ['jquery', 'grwi-preview-opts'], $builder_ver, true);
        wp_enqueue_script('grwi-customize', GRWI_PLUGIN_URL . 'assets/admin-customize.js', array_merge($deps, ['grwi-preview-opts']), $customize_ver, true);

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $embed_key = sanitize_text_field(wp_unslash($_GET['widget'] ?? ''));
        $is_linked = $client->is_linked();

        $site_id = (int) get_option('grwi_site_id', 0);
        $checkout_context = array_filter([
            'widget' => $embed_key !== '' ? $embed_key : null,
            'site_id' => $site_id > 0 ? $site_id : null,
        ]);
        $trial_url = self::with_checkout_context(
            (string) ($caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly'),
            $checkout_context
        );
        $upgrade_checkout_url = self::with_checkout_context(
            (string) ($caps['upgrade_checkout_url'] ?? ($caps['upgrade_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly')),
            $checkout_context
        );
        $business_trial_url = self::with_checkout_context(
            (string) ($caps['business_trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly'),
            $checkout_context
        );
        $business_upgrade_checkout_url = self::with_checkout_context(
            (string) ($caps['business_upgrade_checkout_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly'),
            $checkout_context
        );
        $agency_trial_url = self::with_checkout_context(
            (string) ($caps['agency_trial_url'] ?? 'https://grwidget.com/billing/checkout/confirm?plan=agency&cycle=monthly&source=wordpress'),
            $checkout_context
        );
        $agency_upgrade_checkout_url = self::with_checkout_context(
            (string) ($caps['agency_upgrade_checkout_url'] ?? 'https://grwidget.com/billing/checkout/confirm?plan=agency&cycle=monthly&source=wordpress&upgrade=1'),
            $checkout_context
        );

        wp_localize_script('grwi-customize', 'grwiCustomize', [
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('grwi_customize'),
            'adminNonce' => wp_create_nonce('grwi_admin'),
            'embedKey' => $embed_key,
            'siteId' => $site_id,
            'dashboardUrl' => GRWI_Admin::admin_page_url(),
            'previewScriptUrl' => $caps['preview_script_url'] ?? '',
            'pluginUrl' => GRWI_PLUGIN_URL,
            'pluginVersion' => GRWI_VERSION,
            'pluginAssetVersion' => self::asset_version('assets/google-search-stars-rich-result.svg'),
            'upgradeUrl' => $caps['upgrade_url'] ?? '',
            'trialUrl' => $trial_url,
            'upgradeCheckoutUrl' => $upgrade_checkout_url,
            'businessTrialUrl' => $business_trial_url,
            'businessUpgradeCheckoutUrl' => $business_upgrade_checkout_url,
            'agencyTrialUrl' => $agency_trial_url,
            'agencyUpgradeCheckoutUrl' => $agency_upgrade_checkout_url,
            'linkUrl' => $caps['link_url'] ?? 'https://grwidget.com/dashboard/account?source=wordpress&wp_link=1#wordpress',
            'isLinked' => $is_linked,
            'trialEligible' => array_key_exists('trial_eligible', $caps) && $caps['trial_eligible'] !== null
                ? (int) (bool) $caps['trial_eligible']
                : '',
            'trialCopy' => is_array($caps['trial_copy'] ?? null) ? $caps['trial_copy'] : [],
            'previewFirst' => ! empty($caps['preview_first']),
            'previewFirstCatalog' => is_array($caps['preview_first_catalog'] ?? null) ? $caps['preview_first_catalog'] : [],
            'layoutUpgradeHint' => (string) ($caps['layout_upgrade_hint'] ?? ''),
            'layoutTabEnabled' => self::layout_tab_enabled(),
            'mergedSettingsNav' => self::merged_settings_nav(),
            'layoutCatalog' => $caps['layout_catalog'] ?? [],
            'layoutSections' => $caps['layout_sections'] ?? [],
            'layoutPreviewTheme' => $caps['layout_preview_theme'] ?? 'light',
            'layoutPreviewDemo' => $caps['layout_preview_demo'] ?? null,
            'adminEmail' => (string) wp_get_current_user()->user_email,
            'i18n' => [
                'saved' => __('Widget styling saved.', 'gr-widget'),
                'saveFailed' => __('Could not save widget styling.', 'gr-widget'),
                'saving' => __('Saving…', 'gr-widget'),
                'save' => __('Save changes', 'gr-widget'),
                'statusSaved' => __('Saved', 'gr-widget'),
                'statusUnsaved' => __('Unsaved changes', 'gr-widget'),
                'leaveUnsavedTitle' => __('Unsaved changes', 'gr-widget'),
                'leaveUnsavedBody' => __('You have unsaved changes. Save before leaving, or discard them.', 'gr-widget'),
                'leaveSaveAndLeave' => __('Save & leave', 'gr-widget'),
                'leaveWithoutSaving' => __('Leave without saving', 'gr-widget'),
                'leaveStay' => __('Cancel', 'gr-widget'),
                'previewLoading' => __('Loading preview…', 'gr-widget'),
                'previewFailed' => __('Could not load preview.', 'gr-widget'),
                'copied' => __('Copied!', 'gr-widget'),
                'copy' => __('Copy', 'gr-widget'),
                'back' => __('All widgets', 'gr-widget'),
                'customizeLocked' => __('Start 7-day free trial for advanced customizations', 'gr-widget'),
                'customizeLockedHint' => __('Margins, element order, and advanced layout controls — try full features free for 7 days. Cancel before the trial ends and you won’t be charged.', 'gr-widget'),
                'reportBug' => __('Help & feedback', 'gr-widget'),
                'reportBugTitle' => __('Report a bug', 'gr-widget'),
                'reportBugHint' => __('Describe what went wrong. We include your widget key and builder section when possible.', 'gr-widget'),
                'reportBugSending' => __('Sending…', 'gr-widget'),
                'reportBugSent' => __('Thanks — your bug report was sent. Check your email for a follow-up link.', 'gr-widget'),
                'reportBugFailed' => __('Could not send the bug report. Please try again or post in the community.', 'gr-widget'),
                'reportBugCancel' => __('Cancel', 'gr-widget'),
                'reportBugSend' => __('Send report', 'gr-widget'),
                'whatHappened' => __('What happened?', 'gr-widget'),
                'emailLabel' => __('Email', 'gr-widget'),
                'emailRequired' => __('Email (required)', 'gr-widget'),
                'dismiss' => __('Dismiss', 'gr-widget'),
                'installWidget' => __('Install widget', 'gr-widget'),
                'previewReady' => __('Showing your synced Google reviews.', 'gr-widget'),
                'layoutUpgradeHint' => __('Unlock 31 layouts with Site', 'gr-widget'),
                'layoutUpgradeHintUnlinked' => __('Link Free for 17 more layouts · Site unlocks 31', 'gr-widget'),
                'selected' => __('Selected', 'gr-widget'),
                'upgrade' => __('Upgrade', 'gr-widget'),
                'freeWithAccount' => __('FREE WITH ACCOUNT', 'gr-widget'),
                'sitePlan' => __('SITE PLAN', 'gr-widget'),
                'businessPlan' => __('BUSINESS PLAN', 'gr-widget'),
                'sitePlanPlus' => __('SITE PLAN', 'gr-widget'),
                'businessPlanPlus' => __('BUSINESS PLAN', 'gr-widget'),
                /* translators: %s: layout name. */
                'linkLayoutTitle' => __('Unlock %s with a free account', 'gr-widget'),
                'linkLayoutBody' => __('Link a free account to unlock this layout. Free includes 22 layouts; Site unlocks 31 with up to 30 reviews, reviewer photos, filters and bi-weekly syncing.', 'gr-widget'),
                'linkLayoutCta' => __('Link free account', 'gr-widget'),
                'linkLayoutSecondary' => __('Continue with current layout', 'gr-widget'),
                'linkLayoutFooter' => __('No payment required', 'gr-widget'),
                /* translators: %s: layout name. */
                'siteLayoutTitle' => __('Unlock %s with Site', 'gr-widget'),
                /* translators: %s: layout name. */
                'siteLayoutBody' => __('Display your reviews using the %s. Site also includes 31 layouts, up to 30 reviews, reviewer photos, filters, bi-weekly syncing and full design control.', 'gr-widget'),
                'siteLayoutSupporting' => __('$0 today. Your first payment of $5.99 is after 7 days unless you cancel.', 'gr-widget'),
                'siteLayoutCta' => __('Start 7-day Site trial', 'gr-widget'),
                'siteLayoutSecondary' => __('Continue with current layout', 'gr-widget'),
                'siteLayoutFooter' => __('Cancel anytime during the trial', 'gr-widget'),
                /* translators: %s: widget name. */
                'editingSubtitle' => __('%s · Editing', 'gr-widget'),
                'sitePlanName' => __('Site', 'gr-widget'),
                'businessPlanName' => __('Business', 'gr-widget'),
                'featureTrialSecondary' => __('Not now', 'gr-widget'),
                /* translators: %s: feature name. */
                'linkFeatureTitle' => __('Unlock %s with a free account', 'gr-widget'),
                'linkFeatureBody' => __('Link a free GR Widget account to start a trial and unlock premium features.', 'gr-widget'),
                /* translators: %s: plan name. */
                'featureTrialBody' => __('Start a 7-day free trial of %s to unlock this feature and premium tools.', 'gr-widget'),
                /* translators: %s: plan name. */
                'featureUpgradeBody' => __('Upgrade to %s to unlock this feature.', 'gr-widget'),
                'businessTrialSupporting' => __('$0 today. Your first payment of $14.99 is after 7 days unless you cancel.', 'gr-widget'),
                'trialUnknownSupporting' => __('Trial eligibility will be confirmed before payment.', 'gr-widget'),
                'trialIneligibleSupporting' => __('Charged at checkout. Cancel anytime.', 'gr-widget'),
                'businessTrialIneligibleSupporting' => __('Charged at checkout. Cancel anytime.', 'gr-widget'),
                /* translators: %s: required plan name. */
                'premiumPreviewLock' => __('Preview freely — %s is required to publish', 'gr-widget'),
                'agencyPlanName' => __('Agency', 'gr-widget'),
                'agencyPlanCompact' => __('AGENCY', 'gr-widget'),
                'previewFirstContinueEditing' => __('Continue editing', 'gr-widget'),
                'previewFirstStartTrial' => __('Start my free trial', 'gr-widget'),
                'previewFirstDraftSaved' => __('Draft saved. Your current live widget is unchanged.', 'gr-widget'),
                /* translators: %s: required plan name. */
                'previewFirstBannerTitle' => __('Your design uses %s features', 'gr-widget'),
                'previewFirstBannerTitleBusiness' => __('Your design requires Business', 'gr-widget'),
                /* translators: 1: list of premium features, 2: required plan name. */
                'previewFirstBannerBody' => __('%1$s require %2$s to publish. Keep designing for free—your current live widget won’t change.', 'gr-widget'),
                /* translators: 1: premium feature name, 2: required plan name. */
                'previewFirstBannerBodySingular' => __('%1$s requires %2$s to publish. Keep designing for free—your current live widget won’t change.', 'gr-widget'),
                /* translators: %s: plan name. */
                'previewFirstUpgradePublish' => __('Upgrade to %s & publish', 'gr-widget'),
                'previewFirstPublish' => __('Publish changes', 'gr-widget'),
                'previewFirstLinkPublish' => __('Link free account & publish', 'gr-widget'),
                'previewFirstLinkTitle' => __('Link a free account to publish this layout', 'gr-widget'),
                'previewFirstLinkTitleGeneric' => __('Link a free account to publish', 'gr-widget'),
                /* translators: %s: layout name. */
                'previewFirstLinkBody' => __('%s is included free when you link a GR Widget account. Keep designing—your current live widget won’t change.', 'gr-widget'),
                /* translators: %d: maximum number of reviews. */
                'previewFirstLinkBodyReviews' => __('Link a free account to show up to %d reviews. Keep designing—your current live widget won’t change.', 'gr-widget'),
                'previewFirstLinkReassurance' => __('Free to link · No card required · Returns you to WordPress', 'gr-widget'),
                'previewFirstLinkCta' => __('Link free account', 'gr-widget'),
                'previewFirstLinkUnlocks' => __('See what linking unlocks', 'gr-widget'),
                'brandingHiddenTitle' => __('Branding hidden in this preview', 'gr-widget'),
                'brandingHiddenBody' => __('Upgrade to Site to publish your widget without the GR Widget link.', 'gr-widget'),
                'brandingHiddenEntitledBody' => __('The GR Widget link is hidden in this preview. You can restore it anytime.', 'gr-widget'),
                'brandingTrialCta' => __('Start your 7-day Site trial', 'gr-widget'),
                'previewFirstViewFeatures' => __('View included features', 'gr-widget'),
                'saveDraft' => __('Save draft', 'gr-widget'),
                'publishChanges' => __('Publish changes', 'gr-widget'),
                /* translators: %s: plan name. */
                'upgradeAndPublish' => __('Upgrade to %s & publish', 'gr-widget'),
                'customizeTrialHeadline' => __('Make every widget match your brand', 'gr-widget'),
                'customizeTrialBody' => __('Try custom colours, typography, spacing, borders, and labels free for 7 days on Site.', 'gr-widget'),
                'customizeTrialCta' => __('Start 7-day Site trial', 'gr-widget'),
                'customizeTrialFoot' => __('Then $5.99/month · Cancel anytime', 'gr-widget'),
                'customizeUpgradeHeadline' => __('Make every widget match your brand', 'gr-widget'),
                'customizeUpgradeBody' => __('Unlock custom colours, typography, spacing, borders, and labels with Site.', 'gr-widget'),
                'customizeUpgradeCta' => __('Upgrade to Site', 'gr-widget'),
                'customizeUpgradeFoot' => __('From $5.99/month · Cancel anytime', 'gr-widget'),
                'sitePlanPill' => __('SITE PLAN', 'gr-widget'),
                'businessPlanPill' => __('BUSINESS PLAN', 'gr-widget'),
                'filtersTrialHeadline' => __('Unlock review filters and sorting with Site', 'gr-widget'),
                'filtersTrialBody' => __('Choose which reviews appear using star ratings, keywords and reviewer filters, and sort them by newest, rating or a custom order. Site also includes reviewer profile photos, up to 30 reviews and bi-weekly syncing.', 'gr-widget'),
                'filtersTrialCta' => __('Start 7-day Site trial', 'gr-widget'),
                'filtersTrialFoot' => __('Then $5.99/month · Cancel anytime', 'gr-widget'),
                'filtersUpgradeHeadline' => __('Unlock review filters and sorting with Site', 'gr-widget'),
                'filtersUpgradeBody' => __('Choose which reviews appear using star ratings, keywords and reviewer filters, and sort them by newest, rating or a custom order. Site also includes reviewer profile photos, up to 30 reviews and bi-weekly syncing.', 'gr-widget'),
                'filtersUpgradeCta' => __('Upgrade to Site', 'gr-widget'),
                'filtersUpgradeFoot' => __('From $5.99/month · Cancel anytime', 'gr-widget'),
                'aiTrialHeadline' => __('Unlock AI Summary', 'gr-widget'),
                'aiTrialBody' => __('Try an AI-written review overview on your feed free for 7 days.', 'gr-widget'),
                'aiTrialCta' => __('Start 7-day Business trial', 'gr-widget'),
                'aiTrialFoot' => __('Then $14.99/month · Cancel anytime', 'gr-widget'),
                'aiUpgradeHeadline' => __('Unlock AI Summary', 'gr-widget'),
                'aiUpgradeBody' => __('Add an AI-written review overview to your feed with Business.', 'gr-widget'),
                'aiUpgradeCta' => __('Upgrade to Business', 'gr-widget'),
                'aiUpgradeFoot' => __('From $14.99/month · Cancel anytime', 'gr-widget'),
            ],
        ]);
    }

    public static function layout_tab_enabled(): bool
    {
        return version_compare((string) GRWI_VERSION, '1.0.4', '>=');
    }

    /**
     * 1.0.5+ merges Options into Settings. Never show an Options tab.
     */
    public static function merged_settings_nav(): bool
    {
        return version_compare((string) GRWI_VERSION, '1.0.3', '>');
    }

    /**
     * Drop a stale Options section from API schema and map leftover fields onto Settings.
     *
     * @param array<string, mixed> $builder
     * @return array<string, mixed>
     */
    public static function apply_merged_settings_nav(array $builder): array
    {
        if (! self::merged_settings_nav()) {
            return $builder;
        }

        $sections = is_array($builder['sections'] ?? null) ? $builder['sections'] : [];
        $had_options = false;
        $sections = array_values(array_filter($sections, static function ($section) use (&$had_options) {
            if (! is_array($section)) {
                return false;
            }
            if (sanitize_key($section['id'] ?? '') === 'options') {
                $had_options = true;

                return false;
            }

            return true;
        }));

        if ($had_options) {
            $settings_index = null;
            foreach ($sections as $i => $section) {
                if (sanitize_key($section['id'] ?? '') === 'settings') {
                    $settings_index = $i;
                    break;
                }
            }

            $insert_at = 0;
            foreach ($sections as $i => $section) {
                if (sanitize_key($section['id'] ?? '') === 'layout') {
                    $insert_at = $i + 1;
                    break;
                }
            }

            if ($settings_index !== null) {
                $settings_section = $sections[$settings_index];
                unset($sections[$settings_index]);
                $sections = array_values($sections);
                if ($settings_index < $insert_at) {
                    $insert_at--;
                }
                array_splice($sections, min($insert_at, count($sections)), 0, [$settings_section]);
            } else {
                array_splice($sections, min($insert_at, count($sections)), 0, [[
                    'id' => 'settings',
                    'title' => __('Settings', 'gr-widget'),
                    'subtitle' => __('Placement, spacing, and structured data', 'gr-widget'),
                ]]);
            }
        }

        $fields = is_array($builder['fields'] ?? null) ? $builder['fields'] : [];
        foreach ($fields as $i => $field) {
            if (! is_array($field)) {
                continue;
            }
            $section = sanitize_key($field['section'] ?? '');
            $group = sanitize_key($field['group'] ?? '');
            $key = sanitize_key($field['key'] ?? '');
            $placementKeys = [
                'widget_display_mode' => true,
                'widget_float_position' => true,
                'widget_device_visibility' => true,
                'widget_float_offsets' => true,
                'widget_align' => true,
            ];
            $placementGroups = [
                'placement' => true,
                'display_mode' => true,
                'float_position' => true,
                'device_visibility' => true,
                'float_offsets' => true,
            ];
            if ($section === 'options') {
                $fields[$i]['section'] = 'settings';
                $section = 'settings';
            }
            if (($section === 'settings' || $section === 'options')
                && (isset($placementKeys[$key]) || isset($placementGroups[$group]))) {
                $fields[$i]['group'] = 'placement';
            }
        }

        $builder['sections'] = $sections;
        $builder['fields'] = $fields;

        return $builder;
    }

    /**
     * Cache-bust local builder assets when their file contents change.
     */
    private static function asset_version(string $relative_path): string
    {
        $path = GRWI_PLUGIN_DIR . ltrim($relative_path, '/');
        if (is_readable($path)) {
            $mtime = @filemtime($path);
            if ($mtime) {
                return GRWI_VERSION . '.' . $mtime;
            }
        }

        return GRWI_VERSION;
    }

    /**
     * @param array<string, mixed> $context
     */
    private static function with_checkout_context(string $url, array $context): string
    {
        $url = esc_url_raw($url);
        if ($url === '' || $context === []) {
            return $url;
        }
        $parts = [];
        foreach ($context as $key => $value) {
            if ($value === null || $value === '') {
                continue;
            }
            $parts[$key] = $value;
        }
        if (! isset($parts['source']) || $parts['source'] === 'pricing') {
            $parts['source'] = 'wordpress';
        }
        if ($parts === []) {
            return $url;
        }

        return add_query_arg($parts, $url);
    }

    public static function render_page(): void
    {
        if (! current_user_can('manage_options')) {
            return;
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $embed_key = sanitize_text_field(wp_unslash($_GET['widget'] ?? ''));
        if ($embed_key === '') {
            wp_safe_redirect(GRWI_Admin::admin_page_url());
            exit;
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered(false);
        $editor = $client->get_widget_editor($embed_key);

        if (is_wp_error($editor)) {
            $error_message = $client->is_reconnect_error($editor)
                ? $client->reconnect_message()
                : $client->user_facing_message($editor->get_error_message());
            $grwi_error_reconnect = $client->is_reconnect_error($editor);
            include GRWI_PLUGIN_DIR . 'includes/views/customize-error.php';

            return;
        }

        $widget = is_array($editor['widget'] ?? null) ? $editor['widget'] : [];
        $config = is_array($editor['config'] ?? null) ? $editor['config'] : [];
        $features = is_array($editor['features'] ?? null) ? $editor['features'] : [];
        $limits = is_array($editor['limits'] ?? null) ? $editor['limits'] : [];
        $caps = $client->capabilities();
        $can_customize = ! empty($editor['can_use_builder_customize']);
        $max_reviews_shown = (int) ($limits['max_reviews_shown'] ?? 10);
        $upgrade_url = esc_url($editor['upgrade_url'] ?? ($caps['upgrade_url'] ?? ''));

        $builder = is_array($editor['builder'] ?? null) ? $editor['builder'] : [];
        $builder = self::apply_merged_settings_nav($builder);
        $layout_key = sanitize_key(
            $widget['layout']
            ?? ($builder['layout'] ?? null)
            ?? ($editor['layout'] ?? null)
            ?? ($config['layout'] ?? null)
            ?? 'badge_card'
        );
        $layout_label = self::resolve_layout_label($layout_key, $widget, $builder, $caps);

        // Layout tab: only on plugin >= 1.0.4 (version_compare gate).
        $layout_tab_enabled = self::layout_tab_enabled();
        $sections = is_array($builder['sections'] ?? null) ? $builder['sections'] : [];
        $sections = array_values(array_filter($sections, static function ($section) use ($layout_tab_enabled) {
            if (! is_array($section)) {
                return false;
            }
            $section_id = sanitize_key($section['id'] ?? '');
            if ($section_id === '') {
                return false;
            }
            if (! $layout_tab_enabled && $section_id === 'layout') {
                return false;
            }

            return true;
        }));
        $section_ids = [];
        foreach ($sections as $section) {
            $section_id = sanitize_key($section['id'] ?? '');
            if ($section_id !== '') {
                $section_ids[] = $section_id;
            }
        }
        if ($layout_tab_enabled && ! in_array('layout', $section_ids, true)) {
            array_unshift($sections, [
                'id' => 'layout',
                'title' => __('Layout', 'gr-widget'),
                'subtitle' => __('Choose a layout to get started with', 'gr-widget'),
            ]);
            $section_ids = array_merge(['layout'], $section_ids);
        }
        if ($layout_tab_enabled) {
            if (empty($builder['layout_catalog']) && ! empty($caps['layout_catalog'])) {
                $builder['layout_catalog'] = $caps['layout_catalog'];
            }
            if (empty($builder['layout_sections']) && ! empty($caps['layout_sections'])) {
                $builder['layout_sections'] = $caps['layout_sections'];
            }
            if (empty($builder['layout_preview_theme']) && ! empty($caps['layout_preview_theme'])) {
                $builder['layout_preview_theme'] = $caps['layout_preview_theme'];
            }
        }
        $builder['sections'] = $sections;
        $editor['builder'] = $builder;

        // Preserve tri-state trial eligibility: true / false / null (unlinked/unknown).
        if (! $client->is_linked()) {
            $editor['trial_eligible'] = null;
        } elseif (array_key_exists('trial_eligible', $editor)) {
            $editor['trial_eligible'] = (bool) $editor['trial_eligible'];
        }
        $site_id = (int) get_option('grwi_site_id', 0);
        $checkout_context = array_filter([
            'source' => 'wordpress',
            'widget' => $embed_key !== '' ? $embed_key : null,
            'site_id' => $site_id > 0 ? $site_id : null,
        ]);
        if (! empty($editor['trial_url'])) {
            $editor['trial_url'] = self::with_checkout_context((string) $editor['trial_url'], $checkout_context);
        } else {
            $editor['trial_url'] = self::with_checkout_context(
                (string) ($caps['trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly'),
                $checkout_context
            );
        }
        if (! empty($editor['upgrade_checkout_url'])) {
            $editor['upgrade_checkout_url'] = self::with_checkout_context((string) $editor['upgrade_checkout_url'], $checkout_context);
        } else {
            $editor['upgrade_checkout_url'] = self::with_checkout_context(
                (string) ($caps['upgrade_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=site&cycle=monthly'),
                $checkout_context
            );
        }
        if (! empty($editor['business_trial_url'])) {
            $editor['business_trial_url'] = self::with_checkout_context((string) $editor['business_trial_url'], $checkout_context);
        } else {
            $editor['business_trial_url'] = self::with_checkout_context(
                (string) ($caps['business_trial_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly'),
                $checkout_context
            );
        }
        if (! empty($editor['business_upgrade_checkout_url'])) {
            $editor['business_upgrade_checkout_url'] = self::with_checkout_context(
                (string) $editor['business_upgrade_checkout_url'],
                $checkout_context
            );
        } else {
            $editor['business_upgrade_checkout_url'] = self::with_checkout_context(
                (string) ($caps['business_upgrade_checkout_url'] ?? 'https://grwidget.com/pricing?source=wordpress&plan=business&cycle=monthly'),
                $checkout_context
            );
        }

        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $requested_tab = sanitize_key(wp_unslash($_GET['tab'] ?? ''));
        $grwi_active_section = self::resolve_active_section($requested_tab, $section_ids);
        // phpcs:ignore WordPress.Security.NonceVerification.Recommended
        $grwi_created = ! empty($_GET['grwi_created']);
        $grwi_preview_first = ! empty($editor['preview_first']) || ! empty($caps['preview_first']);
        if ($grwi_preview_first) {
            $editor['preview_first'] = true;
            $editor['premium_preview'] = true;
        }

        include GRWI_PLUGIN_DIR . 'includes/views/customize-page.php';
    }

    public static function ajax_preview_data(): void
    {
        check_ajax_referer('grwi_customize', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $embed_key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? $_GET['embed_key'] ?? ''));
        if ($embed_key === '') {
            wp_send_json_error(['message' => __('Missing widget key.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->get_widget_preview_data($embed_key);

        if (is_wp_error($result)) {
            wp_send_json_error([
                'message' => $client->is_reconnect_error($result)
                    ? $client->reconnect_message()
                    : $client->user_facing_message($result->get_error_message()),
                'reconnect' => $client->is_reconnect_error($result),
            ], $client->is_reconnect_error($result) ? 401 : 500);
        }

        wp_send_json_success($result);
    }

    public static function ajax_save_widget(): void
    {
        check_ajax_referer('grwi_customize', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $embed_key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? ''));
        if ($embed_key === '') {
            wp_send_json_error(['message' => __('Missing widget key.', 'gr-widget')], 422);
        }

        // The local closed schema validates scalar types, enums, bounds and lists.
        // phpcs:ignore WordPress.Security.ValidatedSanitizedInput.InputNotSanitized -- GRWI_Config::sanitize validates all decoded fields before forwarding.
        $config = GRWI_Config::sanitize(wp_unslash($_POST['config'] ?? ''));
        if (is_wp_error($config)) {
            wp_send_json_error(['message' => $config->get_error_message()], 422);
        }

        $payload = ['config' => $config];
        $layout = sanitize_text_field(wp_unslash($_POST['layout'] ?? ''));
        if ($layout !== '') {
            $payload['layout'] = $layout;
        }
        $save_mode = sanitize_key(wp_unslash($_POST['save_mode'] ?? ''));
        if ($save_mode !== '' && ! in_array($save_mode, ['auto', 'draft', 'publish'], true)) {
            wp_send_json_error(['message' => __('Invalid save mode.', 'gr-widget')], 422);
        }
        if ($save_mode !== '') {
            $payload['save_mode'] = $save_mode;
        }
        if (isset($_POST['publish_plan_safe'])) {
            $plan_safe = filter_var(wp_unslash($_POST['publish_plan_safe']), FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($plan_safe === null) {
                wp_send_json_error(['message' => __('Invalid publish option.', 'gr-widget')], 422);
            }
            $payload['publish_plan_safe'] = $plan_safe;
        }

        $client = new GRWI_API_Client();
        $client->ensure_registered(false);
        $result = $client->update_widget($embed_key, $payload);

        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            $status = is_array($data) ? (int) ($data['status'] ?? 500) : 500;
            $body = is_array($data['body'] ?? null) ? $data['body'] : [];
            $error = [
                'message' => $client->is_reconnect_error($result)
                    ? $client->reconnect_message()
                    : $client->user_facing_message($result->get_error_message()),
                'reconnect' => $client->is_reconnect_error($result),
            ];
            if (is_array($body)) {
                foreach (['publish_blocked', 'draft_saved', 'live_unchanged', 'requirement', 'editor'] as $key) {
                    if (array_key_exists($key, $body)) {
                        $error[$key] = $body[$key];
                    }
                }
            }
            wp_send_json_error($error, max(400, $status));
        }

        wp_send_json_success($result);
    }

    /**
     * Human layout name for the customize topbar subtitle.
     *
     * @param array<string, mixed> $widget
     * @param array<string, mixed> $builder
     * @param array<string, mixed> $caps
     */
    private static function resolve_layout_label(string $layout_key, array $widget, array $builder, array $caps): string
    {
        $candidates = [
            $widget['layout_label'] ?? null,
            $builder['layout_label'] ?? null,
        ];
        foreach ($candidates as $candidate) {
            $label = sanitize_text_field((string) $candidate);
            if ($label !== '' && $label !== $layout_key) {
                return $label;
            }
        }

        $catalog = is_array($caps['layout_catalog'] ?? null) ? $caps['layout_catalog'] : [];
        foreach ($catalog as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            if (sanitize_key((string) ($entry['key'] ?? '')) !== $layout_key) {
                continue;
            }
            $label = sanitize_text_field((string) ($entry['label'] ?? ''));
            if ($label !== '') {
                return $label;
            }
        }

        $defaults = GRWI_API_Client::default_capabilities();
        $fallback_catalog = is_array($defaults['layout_catalog'] ?? null) ? $defaults['layout_catalog'] : [];
        foreach ($fallback_catalog as $entry) {
            if (! is_array($entry)) {
                continue;
            }
            if (sanitize_key((string) ($entry['key'] ?? '')) !== $layout_key) {
                continue;
            }
            $label = sanitize_text_field((string) ($entry['label'] ?? ''));
            if ($label !== '') {
                return $label;
            }
        }

        $humanized = ucwords(str_replace('_', ' ', $layout_key));

        return $humanized !== '' ? $humanized : __('Widget', 'gr-widget');
    }

    public static function ajax_report_bug(): void
    {
        check_ajax_referer('grwi_customize', 'nonce');

        if (! current_user_can('manage_options')) {
            wp_send_json_error(['message' => __('Forbidden.', 'gr-widget')], 403);
        }

        $description = sanitize_textarea_field(wp_unslash($_POST['description'] ?? ''));
        $email = sanitize_email(wp_unslash($_POST['email'] ?? ''));
        $context = sanitize_text_field(wp_unslash($_POST['context'] ?? ''));
        $url = esc_url_raw(wp_unslash($_POST['url'] ?? ''));
        $embed_key = sanitize_text_field(wp_unslash($_POST['embed_key'] ?? ''));

        if ($description === '') {
            wp_send_json_error(['message' => __('Please describe what went wrong.', 'gr-widget')], 422);
        }

        if ($email === '' || ! is_email($email)) {
            wp_send_json_error(['message' => __('A valid email is required so we can follow up.', 'gr-widget')], 422);
        }

        $client = new GRWI_API_Client();
        $result = $client->submit_bug_report([
            'description' => $description,
            'email' => $email,
            'context' => $context,
            'url' => $url,
            'embed_key' => $embed_key,
        ]);

        if (is_wp_error($result)) {
            $data = $result->get_error_data();
            $status = is_array($data) ? (int) ($data['status'] ?? 500) : 500;
            wp_send_json_error(['message' => $result->get_error_message()], max(400, $status));
        }

        wp_send_json_success([
            'message' => $result['message'] ?? __('Thanks — your bug report was sent.', 'gr-widget'),
        ]);
    }
}
