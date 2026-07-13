import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import Dashboard from './pages/dashboard';
import Settings from './pages/settings';
import Layout from './components/layout';

const queryClient = new QueryClient();

function NotFound() {
  return (
    <div className="flex h-full items-center justify-center bg-background text-foreground font-mono">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-primary mb-2">404</h1>
        <p className="text-muted-foreground uppercase tracking-wider">Sector not found</p>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
        <Layout>
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </Layout>
      </WouterRouter>
      <Toaster 
        position="bottom-right" 
        toastOptions={{ 
          className: 'font-mono border-border rounded-none shadow-md uppercase text-xs font-bold tracking-wide' 
        }} 
      />
    </QueryClientProvider>
  );
}
