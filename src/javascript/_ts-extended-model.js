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
    build: function(model) {
        var me = this;
        
        return Ext.define('Rally.technicalservices.model.ExtendedModel', {
            extend: model,
            fields: [{
                name: '__grandparent',
                defaultValue: -1,
                displayName: 'Grandparent',
                attributeDefinition: {
                    Name: '__grandparent',
                    Sortable: true,
                    AttributeType: 'TSExtended',
                    Constrained: true
                }
            }],
            
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
