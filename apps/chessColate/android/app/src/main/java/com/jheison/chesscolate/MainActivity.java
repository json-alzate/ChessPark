package com.jheison.chesscolate;

import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.firebase.authentication.FirebaseAuthenticationPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(android.os.Bundle savedInstanceState) {
        // Registrar el plugin de Firebase Authentication manualmente antes de onCreate
        this.initialPlugins.add(FirebaseAuthenticationPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
