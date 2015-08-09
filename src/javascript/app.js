Ext.define("TSInitiativeSwimlaneKanbanBoard", {
    extend: 'Rally.app.App',
    requires: [
        'Rally.apps.kanban.Settings',
        'Rally.apps.kanban.Column',
        'Rally.ui.gridboard.GridBoard',
        'Rally.ui.gridboard.plugin.GridBoardAddNew',
        'Rally.ui.gridboard.plugin.BoardPolicyDisplayable',
        'Rally.ui.cardboard.plugin.ColumnPolicy',
        'Rally.ui.cardboard.PolicyContainer',
        'Rally.ui.cardboard.CardBoard',
        'Rally.ui.cardboard.plugin.Scrollable',
        'Rally.ui.report.StandardReport',
        'Rally.ui.gridboard.plugin.GridBoardCustomFilterControl',
        'Rally.ui.gridboard.plugin.GridBoardFieldPicker',
        'Rally.ui.cardboard.plugin.FixedHeader'
    ],
    mixins: [],
    cls: 'kanban',
    logger: new Rally.technicalservices.Logger(),

    appName: 'Kanban',

    settingsScope: 'project',
    autoScroll: false,
    
    model: null,
    
    config: {
        defaultSettings: {
            groupByField: 'ScheduleState',
            showRows: false,
            columns: Ext.JSON.encode({
                Defined: {wip: ''},
                'In-Progress': {wip: ''},
                Completed: {wip: ''},
                Accepted: {wip: ''}
            }),
            changeReasonField: 'Resolution',
            cardFields: 'FormattedID,Name,Owner,Discussion,Tasks,Defects', //remove with COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS
            hideReleasedCards: false,
            showCardAge: true,
            cardAgeThreshold: 3,
            pageSize: 25
        }
    },

    launch: function() {
        Deft.Promise.all([
            Rally.technicalservices.ModelBuilder.getPINames(),
            Rally.technicalservices.ModelBuilder.getModel('HierarchicalRequirement')
        ]).then({
            scope: this,
            success: function(results) {
                var pi_names = results[0];
                console.log(pi_names);
                var model = Rally.technicalservices.ModelBuilder.build(results[1],pi_names[pi_names.length-2]);
                
                this.model = model;
                this._setUpCardboard(model);
            },
            failure: function(msg) {
                Ext.Msg.alert(msg);
            }
        });
        this.subscribe(Rally.Message.objectUpdate, this._onReadyFieldChanged, this);
        
    },

    getOptions: function() {
        return [
            {
                text: 'Show Cycle Time Report',
                handler: this._showCycleTimeReport,
                scope: this
            },
            {
                text: 'Show Throughput Report',
                handler: this._showThroughputReport,
                scope: this
            },
            {
                text: 'Print',
                handler: this._print,
                scope: this
            },
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    getSettingsFields: function() {
        return Rally.apps.kanban.Settings.getFields({
            shouldShowColumnLevelFieldPicker: this._shouldShowColumnLevelFieldPicker(),
            defaultCardFields: this.getSetting('cardFields'),
            model: this.model
        });
    },

    /**
     * Called when any timebox scope change is received.
     * @protected
     * @param {Rally.app.TimeboxScope} timeboxScope The new scope
     */
    onTimeboxScopeChange: function(timeboxScope) {
        this.callParent(arguments);
        this.gridboard.destroy();
        this.launch();
    },

    _shouldShowColumnLevelFieldPicker: function() {
        return this.getContext().isFeatureEnabled('COLUMN_LEVEL_FIELD_PICKER_ON_KANBAN_SETTINGS');
    },

    _setUpCardboard: function(model) {
        this.groupByField = model.getField(this.getSetting('groupByField'));
        this._addCardboardContent(model);
    },

    _addCardboardContent: function(model) {
        if ( this.gridboard) { this.gridboard.destroy(); }
                
        var cardboardConfig = this._getCardboardConfig(model);

        var columnSetting = this._getColumnSetting();
        if (columnSetting) {
            cardboardConfig.columns = this._getColumnConfig(columnSetting);
        }

        this.gridboard = this.add(this._getGridboardConfig(cardboardConfig));
    },

    _getGridboardConfig: function(cardboardConfig) {
        var context = this.getContext(),
            modelNames = this._getDefaultTypes(),
            blacklist = ['Successors', 'Predecessors', 'DisplayColor'];

        return {
            xtype: 'rallygridboard',
            stateful: false,
            toggleState: 'board',
            cardBoardConfig: cardboardConfig,
            plugins: [
                {
                    ptype: 'rallygridboardaddnew',
                    addNewControlConfig: {
                        listeners: {
                            beforecreate: this._onBeforeCreate,
                            beforeeditorshow: this._onBeforeEditorShow,
                            scope: this
                        },
                        stateful: true,
                        stateId: context.getScopedStateId('kanban-add-new')
                    }
                },
                {
                    ptype: 'rallygridboardcustomfiltercontrol',
                    filterChildren: true,
                    filterControlConfig: {
                        blackListFields: [],
                        whiteListFields: ['Milestones'],
                        margin: '3 9 3 30',
                        modelNames: modelNames,
                        stateful: true,
                        stateId: context.getScopedStateId('kanban-custom-filter-button')
                    },
                    showOwnerFilter: true,
                    ownerFilterControlConfig: {
                        stateful: true,
                        stateId: context.getScopedStateId('kanban-owner-filter')
                    }
                },
                {
                    ptype: 'rallygridboardfieldpicker',
                    headerPosition: 'left',
                    boardFieldBlackList: blacklist,
                    modelNames: modelNames,
                    boardFieldDefaults: this.getSetting('cardFields').split(',')
                },
                {
                    ptype: 'rallyboardpolicydisplayable',
                    prefKey: 'kanbanAgreementsChecked',
                    checkboxConfig: {
                        boxLabel: 'Show Agreements'
                    }
                }
            ],
            context: context,
            modelNames: modelNames,
            storeConfig: {
                filters: this._getFilters()
            },
            height: this.getHeight()
        };
    },

    _getColumnConfig: function(columnSetting) {
        var columns = [];
        var me = this;
        
        Ext.Object.each(columnSetting, function(column, values) {
            var columnConfig = {
                xtype: 'kanbancolumn',
                storeConfig: {
                    model: me.model
                },
                additionalFetchFields: ['Feature','Parent'],
                enableWipLimit: true,
                wipLimit: values.wip,
                plugins: [{
                    ptype: 'rallycolumnpolicy',
                    app: this
                }],
                value: column,
                columnHeaderConfig: {
                    headerTpl: column || 'None'
                },
                listeners: {
                    invalidfilter: {
                        fn: this._onInvalidFilter,
                        scope: this
                    }
                }
            };
            if(this._shouldShowColumnLevelFieldPicker()) {
                columnConfig.fields = this._getFieldsForColumn(values);
            }
            columns.push(columnConfig);
        }, this);

        columns[columns.length - 1].hideReleasedCards = this.getSetting('hideReleasedCards');

        return columns;
    },

    _getFieldsForColumn: function(values) {
        var columnFields = [];
        if (this._shouldShowColumnLevelFieldPicker()) {
            if (values.cardFields) {
                columnFields = values.cardFields.split(',');
            } else if (this.getSetting('cardFields')) {
                columnFields = this.getSetting('cardFields').split(',');
            }
        }
        return columnFields;
    },

    _onInvalidFilter: function() {
        Rally.ui.notify.Notifier.showError({
            message: 'Invalid query: ' + this.getSetting('query')
        });
    },

    
    _getCardboardConfig: function(model) {
        var config = {
            xtype: 'rallycardboard',
            models: [model],
            plugins: [
                {ptype: 'rallycardboardprinting', pluginId: 'print'},
                {
                    ptype: 'rallyscrollablecardboard',
                    containerEl: this.getEl()
                },
                {ptype: 'rallyfixedheadercardboard'}
            ],
            types: this._getDefaultTypes(),
            attribute: this.getSetting('groupByField'),
            margin: '10px',
            context: this.getContext(),
            listeners: {
                beforecarddroppedsave: this._onBeforeCardSaved,
                load: this._onBoardLoad,
                cardupdated: this._publishContentUpdatedNoDashboardLayout,
                scope: this
            },
            columnConfig: {
                xtype: 'rallycardboardcolumn',
                enableWipLimit: true,
                dropControllerConfig: false
            },
            cardConfig: {
                editable: true,
                showIconMenus: true,
                showAge: this.getSetting('showCardAge') ? this.getSetting('cardAgeThreshold') : -1,
                showBlockedReason: true
            },
            storeConfig: {
                context: this.getContext().getDataContext()
            },
            shouldRetrieveModels: function () {
                return false;
            }
        };
        if (this.getSetting('showRows')) {
            Ext.merge(config, {
                rowConfig: {
                    field: this.getSetting('rowsField'),
                    sortDirection: 'ASC'
                }
            });
        }
        return config;
    },

    _getFilters: function() {
        var filters = [];
        if(this.getSetting('query')) {
            filters.push(Rally.data.QueryFilter.fromQueryString(this.getSetting('query')));
        }
        if(this.getContext().getTimeboxScope()) {
            filters.push(this.getContext().getTimeboxScope().getQueryFilter());
        }
        return filters;
    },

    _getColumnSetting: function() {
        var columnSetting = this.getSetting('columns');
        return columnSetting && Ext.JSON.decode(columnSetting);
    },

    _buildReportConfig: function(report) {
        var reportConfig = {
            report: report,
            work_items: this._getWorkItemTypesForChart()
        };
        if (this.getSetting('groupByField') !== 'ScheduleState') {
            reportConfig.filter_field = this.groupByField.displayName;
        }
        return reportConfig;
    },

    _showCycleTimeReport: function() {
        this._showReportDialog('Cycle Time Report',
            this._buildReportConfig(Rally.ui.report.StandardReport.Reports.CycleLeadTime));
    },

    _showThroughputReport: function() {
        this._showReportDialog('Throughput Report',
            this._buildReportConfig(Rally.ui.report.StandardReport.Reports.Throughput));
    },

    _print: function() {
        this.gridboard.getGridOrBoard().openPrintPage({title: 'Kanban Board'});
    },

    _getWorkItemTypesForChart: function() {
        var types = this.gridboard.getGridOrBoard().getTypes(),
            typeMap = {
                hierarchicalrequirement: 'G',
                defect: 'D'
            };
        return types.length === 2 ? 'N' : typeMap[types[0]];
    },

    _getDefaultTypes: function() {
        return ['User Story', 'Defect'];
    },

    _buildStandardReportConfig: function(reportConfig) {
        var scope = this.getContext().getDataContext();
        return {
            xtype: 'rallystandardreport',
            padding: 10,
            project: scope.project,
            projectScopeUp: scope.projectScopeUp,
            projectScopeDown: scope.projectScopeDown,
            reportConfig: reportConfig
        };
    },

    _showReportDialog: function(title, reportConfig) {
        var height = 450, width = 600;
        this.getEl().mask();
        Ext.create('Rally.ui.dialog.Dialog', {
            title: title,
            autoShow: true,
            draggable: false,
            closable: true,
            modal: false,
            height: height,
            width: width,
            items: [
                Ext.apply(this._buildStandardReportConfig(reportConfig),
                    {
                        height: height,
                        width: width
                    })
            ],
            listeners: {
                close: function() {
                    this.getEl().unmask();
                },
                scope: this
            }
        });
    },

    _onBoardLoad: function() {
        this._publishContentUpdated();
        this.setLoading(false);
    },

    _onBeforeCreate: function(addNew, record, params) {
        Ext.apply(params, {
            rankTo: 'BOTTOM',
            rankScope: 'BACKLOG'
        });
        record.set(this.getSetting('groupByField'), this.gridboard.getGridOrBoard().getColumns()[0].getValue());
    },

    _onBeforeEditorShow: function(addNew, params) {
        params.rankTo = 'BOTTOM';
        params.rankScope = 'BACKLOG';
        params.iteration = 'u';

        var groupByFieldName = this.groupByField.name;

        params[groupByFieldName] = this.gridboard.getGridOrBoard().getColumns()[0].getValue();
    },

    _onReadyFieldChanged: function(record, fields, card) {
        var column = card.ownerColumn;

        
        var columnSetting = this._getColumnSetting();
        if (columnSetting) {
            var setting = columnSetting[column.getValue()];
            
            if (setting && setting.readyMapping && card.getRecord().get('_type') == 'defect') {
                var state = card.getRecord().get('State');
                var ready = card.getRecord().get('Ready');
                
                
                if ( ready && state != setting.readyMapping ) {
                    card.getRecord().set('State', setting.readyMapping);
                    card.getRecord().save().then({
                        success: function() {
                            column.refreshCard(card.getRecord());
                        }
                    });
                }
            }
        }
        
        
    },
    
    _onBeforeCardSaved: function(column, card, type) {
        return false;
//        var columnSetting = this._getColumnSetting();
//        var cardboardSetting = this.getSettings();
//
//        var me = this;
//        
//        if (columnSetting) {
//            var setting = columnSetting[column.getValue()];
//            if (setting && setting.scheduleStateMapping) {
//                card.getRecord().set('ScheduleState', setting.scheduleStateMapping);
//            }
//            
//            if (setting && setting.stateMapping && card.getRecord().get('_type') == 'defect') {
//                card.getRecord().set('State', setting.stateMapping);
//            }
//            
//            if (setting && setting.reasonMapping && card.getRecord().get('_type') == 'defect' ) {
//                card.getRecord().set(cardboardSetting.changeReasonField, setting.reasonMapping);
//            }
//        }
//        
//        return true;
        
    },

    _publishContentUpdated: function() {
        this.fireEvent('contentupdated');
//        if (Rally.BrowserTest) {
//            Rally.BrowserTest.publishComponentReady(this);
//        }
        this.recordComponentReady({
            miscData: {
                swimLanes: this.getSetting('showRows'),
                swimLaneField: this.getSetting('rowsField')
            }
        });
    },

    _publishContentUpdatedNoDashboardLayout: function(x,y,z) {
        console.log(x,y,z);
        this.fireEvent('contentupdated', {dashboardLayout: false});
                                   // column.refreshCard(card.getRecord());
    },
    
    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },
    
    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    },
    
    //onSettingsUpdate:  Override
    onSettingsUpdate: function (settings){
        this.logger.log('onSettingsUpdate',settings);
        Ext.apply(this, settings);
        this.launch();
    }
    
});