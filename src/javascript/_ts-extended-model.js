Ext.define('Rally.technicalservices.ModelBuilder',{
    singleton: true,
    
    getModel: function(modelType){
        var deferred = Ext.create('Deft.Deferred');
        Rally.data.ModelFactory.getModel({
            type: modelType,
            success: function(model) {
                deferred.resolve(model);
            }
        });
        return deferred;
    },
    
    getPINames: function() {
        var deferred = Ext.create('Deft.Deferred');
        
        var store_config = {
            autoLoad: false,
            remoteFilter: true,
            model: Ext.identityFn('TypeDefinition'),
            sorters: {
                property: 'Ordinal',
                direction: 'Desc'
            },
            filters: [
                {
                    property: 'Parent.Name',
                    operator: '=',
                    value: 'Portfolio Item'
                },
                {
                    property: 'Creatable',
                    operator: '=',
                    value: 'true'
                }
            ]
        };
        
        Ext.create('Rally.data.wsapi.Store', store_config).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(Ext.Array.map(records,function(record) {
                        return record.get('ElementName');
                    }));
                } else {
                    console.error("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        
        return deferred;
    },
    
    build: function(model,pi_parent_name) {
        var me = this;
        
        console.log('build with', pi_parent_name);
        
        var pi_fields = Ext.Array.filter(model.getFields(), function(field) {
            return (
                !Ext.isEmpty(field.attributeDefinition) &&  
                    /PortfolioItem/.test(field.attributeDefinition.SchemaType) &&
                    field.name !== 'PortfolioItem'
            );
        });
        
        var pi_name = 'Feature';
        
        if ( pi_fields.length > 0 ) {
            pi_name = pi_fields[0].name;
        }
        
        return Ext.define('Rally.technicalservices.model.TSExtendedModel', {
            extend: model,
            elementName: 'TSExtendedModel',
            fields: [{
                name: pi_name + '.Parent',
                defaultValue: 'None',
                displayName: pi_parent_name || 'Grandparent',
                attributeDefinition: {
                    Name: '__grandparent',
                    Sortable: false,
                    AttributeType: 'TSExtended',
                    Constrained: false
                },
                convert: function(value,record) {
                    var pi = record.get(pi_name);
                    if ( Ext.isEmpty(pi) || Ext.isEmpty(pi.Parent) ) {
                        return "None";
                    }
                    return pi.Parent;
                }
            }],
            isArtifact: function() {
                return false;
            },
            _loadRecordsWithAPromise: me._loadRecordsWithAPromise
        });
    },
    
    _loadRecordsWithAPromise: function(model_name, model_fields, filters, sorters, other_settings){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        
        var settings = {
            model: model_name,
            fetch: model_fields,
            filters:filters,
            sorters:sorters,
            limit:'Infinity'
        };
        
        if (! Ext.isEmpty(other_settings) ){
            settings = Ext.Object.merge(settings,other_settings);
        }
          
        Ext.create('Rally.data.wsapi.Store', settings).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    console.error("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    }
});
