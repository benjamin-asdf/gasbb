(ns gasbb.sheets
  "Small helpers over SpreadsheetApp. Everything returns Clojure data."
  (:require [gasbb.convert :as convert]))

(defn ^js active
  "The spreadsheet the script is bound to (or the active one)."
  []
  (.getActiveSpreadsheet js/SpreadsheetApp))

(defn ^js sheet
  "The sheet called `sheet-name` in the active spreadsheet, or the active
  sheet when called without a name."
  ([] (.getActiveSheet (active)))
  ([sheet-name]
   (or (.getSheetByName (active) sheet-name)
       (throw (ex-info (str "No sheet named " sheet-name) {:sheet sheet-name})))))

(defn- ^js ->sheet [s] (if (string? s) (sheet s) s))

(defn values
  "All values of the data range of `s` (a sheet or sheet name) as a vector
  of row vectors."
  ([] (values (sheet)))
  ([s] (convert/->clj (.getValues (.getDataRange (->sheet s))))))

(defn rows->maps
  "Treats the first row as header and turns the remaining rows into maps
  with keyword keys (\"First Name\" -> :first-name)."
  [rows]
  (let [[header & body] rows
        ks (map convert/header->key header)]
    (mapv #(zipmap ks %) body)))

(defn maps->rows
  "Inverse of rows->maps for the columns `ks`: a header row followed by one
  row per map."
  [ks ms]
  (into [(mapv name ks)] (map (fn [m] (mapv #(get m % "") ks))) ms))

(defn read-maps
  "The data range of `s` as a vector of maps, keyed by the header row."
  ([] (rows->maps (values)))
  ([s] (rows->maps (values s))))

(defn write-rows!
  "Writes the vector of rows `rows` into `s`, starting at A1 (or at
  `row`/`col`, 1-based). Short rows are padded."
  ([s rows] (write-rows! s rows 1 1))
  ([s rows row col]
   (when (seq rows)
     (let [w (reduce max (map count rows))
           data (convert/->js (mapv #(into (vec %) (repeat (- w (count %)) "")) rows))]
       (.setValues (.getRange (->sheet s) row col (count rows) w) data)))
   nil))

(defn append-row!
  "Appends `row` (a sequence of values) below the last row of `s`."
  [s row]
  (.appendRow (->sheet s) (convert/->js (vec row)))
  nil)
