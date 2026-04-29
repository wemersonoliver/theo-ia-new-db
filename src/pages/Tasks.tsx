import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus } from "lucide-react";
import { useAllTasks, TaskWithRelations } from "@/hooks/useAllTasks";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { TaskKPICards, computeStats } from "@/components/tasks/TaskKPICards";
import { TaskFilters, applyFilters, StatusFilter } from "@/components/tasks/TaskFilters";
import { TaskTable } from "@/components/tasks/TaskTable";
import { TaskCharts } from "@/components/tasks/TaskCharts";
import { TaskDialog, TaskFormData } from "@/components/tasks/TaskDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function Tasks() {
  const { tasks, isLoading, toggleTask, createTask, updateTask, deleteTask } = useAllTasks();
  const { members } = useTeamMembers();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [assignee, setAssignee] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<TaskFormData> | null>(null);
  const [toDelete, setToDelete] = useState<TaskWithRelations | null>(null);

  const assignees = useMemo(
    () =>
      members.map((m) => ({
        id: m.user_id,
        name: m.full_name || m.email || "Membro",
      })),
    [members]
  );

  const filtered = useMemo(
    () => applyFilters(tasks, search, status, assignee),
    [tasks, search, status, assignee]
  );

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const handleSubmit = async (data: TaskFormData) => {
    if (data.id) {
      await updateTask.mutateAsync({
        id: data.id,
        updates: {
          title: data.title,
          description: data.description ?? null,
          due_date: data.due_date ?? null,
          assigned_to: data.assigned_to ?? null,
        },
      });
    } else {
      await createTask.mutateAsync({
        deal_id: data.deal_id,
        title: data.title,
        description: data.description ?? null,
        due_date: data.due_date ?? null,
        assigned_to: data.assigned_to ?? null,
      });
    }
  };

  return (
    <DashboardLayout title="Tarefas" description="Gerencie todas as tarefas do seu time">
      <div className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TaskKPICards stats={stats} />
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <TaskFilters
            search={search}
            onSearch={setSearch}
            status={status}
            onStatus={setStatus}
            assignee={assignee}
            onAssignee={setAssignee}
            assignees={assignees}
          />
          <Button
            onClick={() => {
              setEditing(null);
              setDialogOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nova Tarefa
          </Button>
        </div>

        <Tabs defaultValue="list" className="w-full">
          <TabsList>
            <TabsTrigger value="list">Lista</TabsTrigger>
            <TabsTrigger value="performance">Desempenho</TabsTrigger>
          </TabsList>

          <TabsContent value="list" className="mt-4">
            {isLoading ? (
              <div className="rounded-lg border bg-muted/30 p-10 text-center text-sm text-muted-foreground">
                Carregando tarefas...
              </div>
            ) : (
              <TaskTable
                tasks={filtered}
                onToggle={(t) => toggleTask.mutate(t as TaskWithRelations)}
                onEdit={(t) => {
                  const full = tasks.find((x) => x.id === t.id);
                  if (!full) return;
                  setEditing({
                    id: full.id,
                    deal_id: full.deal_id,
                    title: full.title,
                    description: full.description,
                    due_date: full.due_date,
                    assigned_to: full.assigned_to,
                  });
                  setDialogOpen(true);
                }}
                onDelete={(t) => setToDelete(tasks.find((x) => x.id === t.id) ?? null)}
              />
            )}
          </TabsContent>

          <TabsContent value="performance" className="mt-4">
            <TaskCharts tasks={filtered} />
          </TabsContent>
        </Tabs>
      </div>

      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initial={editing}
        assignees={assignees}
        onSubmit={handleSubmit}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(v) => !v && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. A tarefa "{toDelete?.title}" será removida permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) deleteTask.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}